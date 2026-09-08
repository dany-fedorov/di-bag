# DI Bag Release-Candidate Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce frozen, locally verified, reproducible DI Bag release-candidate artifacts and a handoff record that stops before registry, authentication, remote Git, tag, or publication actions.

**Architecture:** Reconcile candidate documentation; use deterministic TypeScript scripts to create and validate a local manifest from explicit tarballs; prove archives through fresh offline consumers; retain exact local evidence for review. Online registry/publication work is a separately authorized runbook.

**Tech Stack:** npm pack JSON/integrity, Node TypeScript scripts, Bun tests, TypeScript 6/7, Node/Bun consumers, SHA-256/SHA-512, offline npm install.

**Spec:** `docs/superpowers/specs/2026-09-08-release-handoff-design.md`

## Global Constraints

- Use repository root and `.related-repos/{sas-box,val-box}` only; never use sibling box directories outside `.related-repos`.
- Keep DI Bag dependency-free: no box in `dependencies`, `peerDependencies`, `optionalDependencies`, or `bundledDependencies`.
- Artifact directory is explicit, absolute, ignored, and contains no secrets.
- Build before `npm pack --ignore-scripts`; every consumer installs explicit tarball paths with `npm install --offline --ignore-scripts --no-audit --no-fund --no-package-lock`.
- Capture the current reviewed native-gap inventory before release validation; fresh IDs must equal that inventory or a strict subset, allowing the prior 27 IDs to become zero while rejecting every new ID or changed fingerprint.
- Complete all source, test, script, manifest, lockfile, README, changelog, migration, and publishing-guide edits before freezing. Post-freeze commits may modify only the final integration report, sanitized release evidence, and enterprise tracker, and the manifest must record and verify that exact path diff.
- Run every retained command with an enforced timeout, RSS ceiling, output bound, signal result, exact argv/cwd, and separately hashed stdout/stderr log. A timeout, signal, output truncation, monitor failure, or nonzero exit rejects the candidate.
- Stop before `npm view`, `npm whoami`, `npm login`, `npm publish`, `npm dist-tag`, `git tag`, `git push`, or credential write. Registry checks are unavailable in this plan.

---

## File structure

| File | Responsibility |
| --- | --- |
| `PUBLISHING.md` | Local candidate workflow, authorization boundary, immutable-version recovery. |
| `CHANGELOG.md` | Release heading matching frozen `package.json` version. |
| `README.md` | Export, adapter/no-box-dependency, and local verification guidance. |
| `docs/migrations/0.1-to-enterprise.md` | Raw/native, scope, adapter, observer, plugin ownership migration rules. |
| `scripts/create-release-manifest.ts` | Validate explicit local inputs and write detailed plus sanitized deterministic candidate JSON. |
| `scripts/run-release-command.ts` | Supervise argv directly and atomically retain bounded command/log evidence. |
| `scripts/release-native-inventory.ts` | Derive reviewed/fresh per-occurrence native diagnostic fingerprints. |
| `scripts/create-release-audit.ts` | Bind final postcommit command records to detailed/public manifest hashes. |
| `scripts/hash-release-tree.ts` | Write deterministic sorted path/bytes/SHA-256 evidence for a built `dist`. |
| `scripts/release-archive.ts` | Safely parse npm gzip/tar bytes once for manifest and verifier checks. |
| `scripts/verify-release-artifacts.ts` | Read-only archive/hash/metadata/content/offline-consumer verifier. |
| `tests/release-artifacts.test.ts` | TDD acceptance/rejection coverage for scripts/docs. |
| `docs/reports/2026-09-08-final-integration-release.md` | Local commands, matrix, hashes, stop statement. |
| `docs/reports/2026-09-08-release-candidate-evidence.json` | Sanitized durable candidate facts without absolute paths or raw logs. |
| `docs/superpowers/plans/2026-09-06-enterprise-di-program.md` | Program state from observed local evidence. |

### Task 1: Freeze facts and reconcile release documentation

**Files:**
- Create: `PUBLISHING.md`
- Create: `tests/release-artifacts.test.ts`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/migrations/0.1-to-enterprise.md`
- Modify: `docs/superpowers/plans/2026-09-06-enterprise-di-program.md`

**Interfaces:**
- Consumes: root `package.json` name/version/exports/files, box fixture provenance, final integration report.
- Produces: docs whose changelog heading equals manifest version, a local evidence workflow, and an explicitly gated, unexecuted online command appendix.

- [ ] **Step 1: Write failing documentation consistency test.**

```ts
test('release documents match frozen manifest and gate every online command', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
  const publishing = readFileSync(resolve(root, 'PUBLISHING.md'), 'utf8');
  expect(changelog).toContain(`## ${manifest.version}`);
  expect(publishing).toContain('DO NOT RUN without fresh explicit authorization');
  for (const name of ['sas-box', 'val-box', 'di-bag']) {
    expect(publishing).toContain(`npm view ${name}@0.1.0 version --registry=https://registry.npmjs.org`);
    expect(publishing).toContain(`npm publish /tmp/di-bag-release-candidate/${name}-0.1.0.tgz --access public --provenance`);
    expect(publishing).toContain(`npm dist-tag add ${name}@0.1.0 latest --registry=https://registry.npmjs.org`);
  }
  expect(publishing).toContain('npm login --registry=https://registry.npmjs.org');
});
```

- [ ] **Step 2: Run test to verify RED.**

Run: `bun test tests/release-artifacts.test.ts -t "release documents"`

Expected: FAIL because DI Bag has no `PUBLISHING.md` and changelog starts at `Unreleased`.

- [ ] **Step 3: Write local-only documentation.**

`PUBLISHING.md` names authoritative candidate directories, freeze fields, required local commands, artifact location, offline consumer requirement, immutable-version recovery, and a separately authorized online runbook. It states registry version/owner/access/tag/provenance status is unavailable without authorization. End the file with this exact, unexecuted appendix headed `DO NOT RUN without fresh explicit authorization`:

```bash
npm view sas-box@0.1.0 version --registry=https://registry.npmjs.org
npm view val-box@0.1.0 version --registry=https://registry.npmjs.org
npm view di-bag@0.1.0 version --registry=https://registry.npmjs.org
npm login --registry=https://registry.npmjs.org
npm publish /tmp/di-bag-release-candidate/sas-box-0.1.0.tgz --access public --provenance
npm dist-tag add sas-box@0.1.0 latest --registry=https://registry.npmjs.org
npm publish /tmp/di-bag-release-candidate/val-box-0.1.0.tgz --access public --provenance
npm dist-tag add val-box@0.1.0 latest --registry=https://registry.npmjs.org
npm publish /tmp/di-bag-release-candidate/di-bag-0.1.0.tgz --access public --provenance
npm dist-tag add di-bag@0.1.0 latest --registry=https://registry.npmjs.org
```

The appendix is documentation only: no task in this plan executes any listed command. Promote `Unreleased` notes to `## 0.1.0` only when frozen manifest remains `0.1.0`; otherwise update all literal package/version strings in the appendix and test to the exact frozen version together.

- [ ] **Step 4: Document public package constraints.**

In the existing README/migration sections document root/node/sas-box/val-box exports, structural adapters, core-only no-box behavior, explicit raw/native classification, selected scopes, non-blocking observers, and plugin validation/original ownership. Do not claim release tag, remote SHA, registry publication, or version availability.

- [ ] **Step 5: Run test to verify GREEN.**

Run: `bun test tests/release-artifacts.test.ts -t "release documents"`

Expected: PASS; heading equals manifest, local workflow exists, and every online command is present only beneath the explicit unexecuted authorization heading.

- [ ] **Step 6: Commit documentation task.**

```bash
git add PUBLISHING.md CHANGELOG.md README.md docs/migrations/0.1-to-enterprise.md docs/superpowers/plans/2026-09-06-enterprise-di-program.md tests/release-artifacts.test.ts
git commit -m "docs: prepare local release candidate handoff"
```

### Task 2: Create manifest writer with TDD

**Files:**
- Create: `scripts/create-release-manifest.ts`
- Create: `scripts/run-release-command.ts`
- Create: `scripts/release-native-inventory.ts`
- Create: `scripts/create-release-audit.ts`
- Create: `scripts/hash-release-tree.ts`
- Create: `scripts/release-archive.ts`
- Modify: `tests/native-diagnostic-markers.ts`
- Modify: `tests/release-artifacts.test.ts`

**Interfaces:**
- Consumes: `--input /tmp/di-bag-release-candidate/release-evidence-input.json`, `--out /tmp/di-bag-release-candidate/candidate.json`, and optional `--public-out docs/reports/2026-09-08-release-candidate-evidence.json`.
- Produces: `ReleaseManifest` from one supplied evidence schema containing package commit/branch/status, tool versions, dry-run/pack JSON, timestamps, and command logs plus derived immutable archive facts. The optional public output is a stable projection that omits absolute paths, raw logs, and the self-referential final handoff commit while retaining candidate source commits, allowed handoff paths, hashes, command argv/results/log hashes, native fingerprints, package metadata, and file lists. `run-release-command.ts` writes the exact command records consumed here. `release-native-inventory.ts` writes the reviewed/fresh fingerprints consumed here.

- [ ] **Step 1: Write failing manifest-input tests.**

```ts
expect(() => parseManifestArgs(['--input', 'relative', '--out', '/tmp/candidate.json']))
  .toThrow('evidence input must be absolute');
expect(() => parseManifestArgs([
  '--input', '/tmp/release/release-evidence-input.json', '--out', '/tmp/candidate.json',
  '--package', 'di-bag=/tmp/a.tgz',
])).toThrow('unsupported option: --package');
```

Test optional `--public-out` rejection for an absolute path, traversal, symlink escape, or any target other than `docs/reports/2026-09-08-release-candidate-evidence.json`. Prove the public projection contains no absolute checkout/archive/log path, records the constant approved handoff-path allowlist rather than the self-referential observed diff, and remains byte-identical when `handoffCommit` or observed `changedPaths` changes within that allowlist.

Also test input rejection for duplicate package records; archive or log paths that are outside by traversal/prefix collision, noncanonical, symlink-escaping, missing, or replaced; missing branch/status/commit/tool/pack JSON/timestamp/command evidence; invalid ISO timestamps, reverse ordering, or inconsistent elapsed duration; duplicate/mutated logs; a nonzero, signaled, timed-out, output-limited, or monitor-failed command; and recorded version differing from `package/package.json`. Native fixtures must reject new or changed fingerprints, duplicate/moved/count-changed occurrences, while accepting an empty fresh inventory and strict subsets.

Add command-runner tests for timeout, RSS, output overflow, signal, spawn failure, stderr preservation, argv values containing spaces, atomic log-write failure, and pre-execution input hashing. Repeated inputs are canonicalized and sorted by path; duplicate inputs reject and caller order cannot change the record. The CLI accepts `--artifact-dir <absolute> --record <contained-json> --cwd <absolute> [--input <absolute>]... -- <argv...>` only, rejects shell strings and online/publish/remote-Git command tokens, and normalizes successful `terminationReason` from the supervisor's `undefined` to `null`. Fixed limits are 900,000 ms, 4096 MiB observed-process RSS, 16 MiB combined output, and 20 ms sampling; exported test-only orchestration accepts smaller injected limits. Stdout and stderr publish atomically per file, the record publishes last as the completion marker, and any failure removes temporary files and best-effort orphan logs; do not claim a multi-file filesystem transaction.

Add inventory-generator tests for exactly 27 committed reviewed declarations, recomputed hashes, repeated IDs with stable occurrences, and rejection of missing/extra/moved/duplicate/changed-code/changed-message records. Its exact command is `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/release-native-inventory.ts --reviewed-root tests/types --fresh-jsonl /tmp/di-bag-release-candidate/logs/di-bag-check-native.stdout --out /tmp/di-bag-release-candidate/native-diagnostics.json`. It consumes the full `gaps` objects already emitted by `scripts/check-native-contracts.ts`; export the deeply frozen exact fingerprint table from `tests/native-diagnostic-markers.ts` so reviewed and fresh records share one authority. `markerOccurrence` is one-based for the same ID within a fixture; paths are POSIX-relative to `tests/types`; messages normalize CRLF/CR to LF without trimming; fingerprint input is stable JSON of `{ id, fixture, markerLine, markerOccurrence, code, normalizedMessage }` in that field order.

Add final-audit tests for missing/duplicate/mutated command records, a record whose pre-execution manifest/public hashes differ, a failed result, wrong final commit/path diff, and deterministic valid output. Its CLI accepts repeated `--record` plus exact `--manifest`, fixed sanitized `--public-evidence`, `--candidate-commit`, `--handoff-commit`, `--out`, and no command execution. It requires exactly five final records with exact argv/cwd roles: HEAD, candidate-to-handoff path diff, status, complete release-artifact test, and final verifier. It validates and hashes those completed postcommit records, then atomically writes `/tmp/di-bag-release-candidate/final-audit.json`; creation is the final validation, so no self-attestation is claimed.

Add release-tree digest tests for sorted regular-file paths, bytes and SHA-256; empty trees, symlinks, special files, traversal/output aliasing, and mutation. Its CLI accepts only canonical `--artifact-dir /tmp/di-bag-release-candidate --root <checkout>/dist --out <artifact-contained-json>`, reads every regular file once, rescans for add/remove/rename, and atomically writes the digest. Task 4 compares byte-identical digest JSON immediately after explicit build, after dry-run/prepack, and after actual `--ignore-scripts` pack.

Add shared archive-parser tests before manifest implementation: decode gzip and 512-byte tar headers with checksum/size/name-prefix/type validation; reject absolute/traversal/backslash/NUL-ambiguous names, prefix collisions, duplicates, links/devices/FIFOs/unknown types, truncation, trailing junk, and size ceilings. `inspectNpmArchive(bytes)` returns sorted regular entries plus exact `package/package.json` bytes without extracting. Task 2 uses it for independent pack/metadata validation; Task 3 imports the same parser before safe extraction instead of duplicating it.

- [ ] **Step 2: Run manifest tests to verify RED.**

Run: `bun test tests/release-artifacts.test.ts`

Expected: FAIL in the manifest, command-runner, native-inventory, and final-audit contracts because their scripts do not exist.

- [ ] **Step 3: Implement exact types and deterministic writer.**

```ts
export type ReleasePackageRecord = Readonly<{
  name: 'di-bag' | 'sas-box' | 'val-box'; version: string; archive: string;
  checkout: Readonly<{ path: string; branch: string; candidateSourceCommit: string; status: string }>;
  pack: Readonly<{ dryRunJson: unknown; packJson: unknown; packedAt: string }>;
  commands: readonly ReleaseCommandEvidence[];
  integrity: string; sha256: string; sha512: string; bytes: number; files: readonly string[];
  packageMetadata: Readonly<{ name: string; version: string; main?: string; types?: string;
    files: readonly string[]; exports: unknown; dependencies: Readonly<Record<string, string>>;
    peerDependencies: Readonly<Record<string, string>>; optionalDependencies: Readonly<Record<string, string>>;
    bundledDependencies: readonly string[] }>;
}>;
export type ReleaseManifest = Readonly<{
  schemaVersion: 1; artifactDirectory: string; generatedAt: string;
  tools: Readonly<{ node: string; npm: string; bun: string; classic6: string; native7: string;
    sasBoxTypeScript: '5.9.3'; valBoxTypeScript: '5.9.3' }>;
  nativeDiagnostics: Readonly<{ reviewedAt: string; reviewedGaps: readonly NativeGapFingerprint[];
    freshGaps: readonly NativeGapFingerprint[] }>;
  handoff: Readonly<{ candidateSourceCommit: string; handoffCommit: string; changedPaths: readonly string[] }>;
  packages: readonly ReleasePackageRecord[];
}>;
```

Add the supplied input type before `ReleaseManifest`:

```ts
export type ReleaseEvidenceInput = Readonly<{
  schemaVersion: 1; generatedAt: string; artifactDirectory: '/tmp/di-bag-release-candidate';
  tools: Readonly<{ node: string; npm: string; bun: string; classic6: string; native7: string;
    sasBoxTypeScript: '5.9.3'; valBoxTypeScript: '5.9.3' }>;
  nativeDiagnostics: Readonly<{ reviewedAt: string; reviewedGaps: readonly NativeGapFingerprint[];
    freshGaps: readonly NativeGapFingerprint[] }>;
  handoff: Readonly<{ candidateSourceCommit: string; handoffCommit: string; changedPaths: readonly string[] }>;
  packages: readonly Readonly<{ name: 'di-bag' | 'sas-box' | 'val-box'; version: string; archive: string;
    checkout: Readonly<{ path: string; branch: string; candidateSourceCommit: string; status: string }>;
    pack: Readonly<{ dryRunJson: unknown; packJson: unknown; packedAt: string }>;
    commands: readonly ReleaseCommandEvidence[]; }> [];
}>;
```

Define `NativeGapFingerprint` with `id`, fixture path, marker line, stable marker occurrence, diagnostic code, normalized message, and SHA-256 fingerprint. Define `ReleaseCommandEvidence` with exact argv array, canonical cwd, valid ordered ISO start/finish timestamps, monotonic elapsed milliseconds, `exitCode: 0`, `signal: null`, `terminationReason: null`, a sorted `inputs` array of pre-execution path/bytes/SHA-256 records, and stdout/stderr path, byte count, and SHA-256. Require `finishedAt >= startedAt` and wall-clock delta within 1,000 ms of monotonic elapsed time to tolerate clock resolution without accepting fabricated duration. Store sorted gap occurrences rather than an ID set because IDs can repeat.

Open each regular archive/log once, validate containment with `realpathSync` plus `path.relative`, and hash the retained bytes so prefix collisions, symlink escapes, and path replacement cannot pass. Sort package records/files/gap occurrences lexically. Require exactly the three package names and reject missing/duplicate facts. Fresh native fingerprint occurrences must be a multiset subset of reviewed occurrences. Derive normalized package metadata and validate every dry-run/actual pack identity, size, shasum, integrity, and file-list field against independently inspected archive bytes. Require the handoff diff to contain only the three approved evidence paths. Do not invoke npm, Git, or a network client; record supplied local facts only.

- [ ] **Step 4: Run manifest tests to verify GREEN.**

Run: `bun test tests/release-artifacts.test.ts`

Expected: PASS; equivalent inputs serialize identically and every invalid input has its stated rejection.

- [ ] **Step 5: Commit manifest task.**

```bash
git add scripts/create-release-manifest.ts scripts/run-release-command.ts scripts/release-native-inventory.ts scripts/create-release-audit.ts scripts/hash-release-tree.ts scripts/release-archive.ts tests/native-diagnostic-markers.ts tests/release-artifacts.test.ts
git commit -m "build: add local release manifest writer"
```

### Task 3: Create archive/offline verifier with TDD

**Files:**
- Create: `scripts/verify-release-artifacts.ts`
- Modify: `tests/release-artifacts.test.ts`

**Interfaces:**
- Consumes: `--manifest /tmp/di-bag-release-candidate/candidate.json` and `--work-dir /tmp/di-bag-release-candidate/verify-work`.
- Produces: exit 0 only when bytes/hashes/integrity, metadata, package contents, exports, and offline consumers agree; prints one JSON report and writes no registry/credential state.

- [ ] **Step 1: Write failing verifier tests.**

```ts
expect(await verifyReleaseArtifacts(tamperedManifest, workDir)).toMatchObject({ ok: false,
  failures: [expect.stringContaining('SHA-512 mismatch')] });
expect(await verifyReleaseArtifacts(manifestWithFixtureFile, workDir)).toMatchObject({ ok: false,
  failures: [expect.stringContaining('forbidden package file')] });
```

Cover five/seven box entry totals, DI Bag `files: ['dist']`, missing root/node/sas-box/val-box pairs, changed integrity, test/source/fixture/node_modules/credential content, and unexpected box in core-only consumer. Construct malicious archives for absolute/traversal names, prefix collisions, symlinks, hardlinks, duplicate entries, truncated gzip, oversized entries, and non-regular tar types; prove each fails before extraction or consumer execution. Cover altered/duplicate pack JSON results, stale dry-run JSON, dry-run/actual file divergence, unexpected filenames, and metadata/dependency mismatch.

- [ ] **Step 2: Run verifier tests to verify RED.**

Run: `bun test tests/release-artifacts.test.ts -t "archive verifier"`

Expected: FAIL because verifier does not exist.

- [ ] **Step 3: Implement read-only archive and consumer verification.**

```ts
export async function verifyReleaseArtifacts(manifestPath: string, workDir: string): Promise<{
  ok: boolean; failures: readonly string[];
}> {
  const manifest = readReleaseManifest(manifestPath);
  const failures = [...verifyArchiveBytes(manifest), ...verifyPackageContents(manifest)];
  if (failures.length > 0) return { ok: false, failures };
  await verifyOfflineConsumers(manifest, workDir, failures);
  return { ok: failures.length === 0, failures };
}
```

Read and hash exact bytes once; parse gzip/tar headers before extraction; reject unsafe names, links, devices, FIFOs, duplicates, excess sizes, and malformed/truncated input. Inspect `package/package.json` and paths and compare normalized metadata. Locate the fixed sanitized evidence path relative to the canonical DI Bag checkout recorded in the detailed manifest; reject it when missing, malformed, stale, extra-field, absolute-path leaking, or different from the deterministic public projection after excluding final `handoffCommit`/observed-diff fields. Three-package consumers execute all four DI Bag public exports in CJS/ESM under Node and Bun and compare the complete I1-I15 JSON oracle. Core-only CJS/ESM consumers run under Node and Bun, assert both box directories absent, and use installed-artifact import-graph tracing so ESM side-effect/self imports cannot load Node or adapter entries. Source-deleted declaration consumers compile with pinned classic TypeScript 6 and native TypeScript 7, `skipLibCheck: false`. Only execute offline install with explicit tarballs through bounded supervision.

- [ ] **Step 4: Run verifier tests to verify GREEN.**

Run: `bun test tests/release-artifacts.test.ts -t "archive verifier"`

Expected: PASS valid fixture and reject every tampering/content/core-only case.

- [ ] **Step 5: Verify CLI scope.**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-release-artifacts.ts --help`

Expected: usage lists only `--manifest` and `--work-dir`; the sanitized path is fixed and cannot be supplied by CLI. No login, publish, tag, registry, credential, push, or remote option exists. Tests also reject unknown/duplicate/missing options, positional arguments, relative or noncontained work directories, manifest/work-directory aliasing, and a nonempty work directory.

- [ ] **Step 6: Commit verifier task.**

```bash
git add scripts/verify-release-artifacts.ts tests/release-artifacts.test.ts
git commit -m "test: verify local release archives offline"
```

### Task 4: Execute frozen local candidate gates and create artifacts

**Files:**
- Create ignored: `/tmp/di-bag-release-candidate/candidate.json`
- Create ignored: `/tmp/di-bag-release-candidate/release-evidence-input.json`
- Create ignored: `/tmp/di-bag-release-candidate/commands.log`
- Create ignored: `/tmp/di-bag-release-candidate/verify-work/`
- Create: `docs/reports/2026-09-08-release-candidate-evidence.json`
- Modify: `docs/reports/2026-09-08-final-integration-release.md`

**Interfaces:**
- Consumes: Tasks 1-3, final integration suite, frozen root/related-repository checkouts.
- Produces: local manifest/log/report with exact commit/branch/status/version/hash/tool/pack/timestamp/command evidence and no remote evidence.

- [ ] **Step 1: Capture and validate freeze inputs.**

Run every probe through `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/run-release-command.ts --artifact-dir /tmp/di-bag-release-candidate --record <unique-contained-record.json> --cwd <absolute-checkout> -- <argv...>`. Probe `git rev-parse --show-toplevel`, `git branch --show-current`, `git rev-parse HEAD`, `git status --short`, `node --version`, `npm --version`, `bun --version`, both DI Bag compiler versions, and each box checkout's local `node_modules/typescript/bin/tsc --version` separately.

Expected: paths match spec; sas-box is exactly `b895f9d1f1d168992f44e9f46025bc1ac9d26e14`; val-box is exactly `07506fcb3e49f460b6de357ecad7d88262a7f32d`; both box statuses are empty. DI Bag status contains only the intentionally preserved untracked `docs/reports/2026-09-08-execution-handoff.md`; any modified source, test, script, manifest, lockfile, package documentation, or build input restarts freeze. Record this DI Bag `HEAD` as `candidateSourceCommit`. Run from all three authoritative checkouts and record branch, candidate commit, exact status, command start/finish timestamps, argv/cwd, signal/termination result, and hashed stdout/stderr logs in `release-evidence-input.json`.

- [ ] **Step 2: Run DI Bag source/native/integration/example gates serially.**

Run separately through `scripts/run-release-command.ts`: `npm run check`; `npm run typecheck:native`; `npm run build:native`; `npm run check:native`; and `bun test tests/final-adversarial-integration.test.ts tests/box-package.test.ts tests/package.test.ts tests/native-package.test.ts`. Assert sorted discovery equals exactly `examples/box-adapters.ts`, `examples/composition.ts`, `examples/contributions.ts`, `examples/modules.ts`, `examples/observers.ts`, `examples/plugins.ts`, `examples/scopes.ts`, `examples/tokens.ts`, and `examples/wbs-scope.ts`; test missing, extra, duplicate, and reordered inputs. Then run each literal file as a separately recorded `bun run <path>` command in that order.

Expected: every exit 0 with null signal/termination, bounded output, and no skip. Feed the retained `npm run check:native` stdout to the exact `scripts/release-native-inventory.ts` command from Task 2. It requires 27 reviewed committed occurrences, recomputes every constituent fingerprint, and allows the fresh multiset to equal the reviewed inventory or a strict subset, including empty; ID-only comparison is insufficient.

- [ ] **Step 3: Run frozen box gates and build before packing.**

Run as separate `scripts/run-release-command.ts` invocations in each related checkout: `npm run check`; `npm run build`; `npm pack --dry-run --json`.

Expected: exit 0; sas-box list has five entries and val-box seven; pack input commits match freeze record. Preserve each dry-run JSON, command timestamps, and hashed output logs in that package's evidence record. Then run DI Bag `npm run build` with classic TypeScript and `npm pack --dry-run --json` immediately before its actual pack; record both and reject any native-build residue or dry-run/actual divergence.

- [ ] **Step 4: Pack all candidates to explicit local artifact directory.**

Run separately in each checkout immediately after its recorded build/dry-run: `npm pack --ignore-scripts --json --pack-destination /tmp/di-bag-release-candidate`

Expected: one tarball per candidate with one JSON result whose filename/name/version/size/unpacked size/shasum/integrity/sorted files match independently inspected bytes and its dry-run. Reject multiple matching tarballs. For each package run `scripts/hash-release-tree.ts` through the command runner immediately after explicit build, after dry-run/prepack, and after actual pack; all three sorted path/bytes/SHA-256 documents must be byte-identical, and `git status --short` must show no prepack change.

- [ ] **Step 5: Write the supplied evidence input, then create and verify manifest.**

Write `/tmp/di-bag-release-candidate/release-evidence-input.json` with exactly one `packages` entry for `di-bag`, `sas-box`, and `val-box`; all must include the schema fields defined in Task 2. Its `artifactDirectory` is exactly `/tmp/di-bag-release-candidate`; each archive is the tarball produced by Step 4; every command entry contains exact argv/cwd/timestamps, `exitCode: 0`, null signal/termination, and canonical retained stdout/stderr paths, sizes, and hashes under that directory. Initially set `handoffCommit` to `candidateSourceCommit` and `changedPaths` empty.

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/create-release-manifest.ts --input /tmp/di-bag-release-candidate/release-evidence-input.json --out /tmp/di-bag-release-candidate/candidate.json --public-out docs/reports/2026-09-08-release-candidate-evidence.json`

Expected: exit 0 and manifest includes SHA-256/SHA-512/integrity/bytes/files plus supplied branch/commit/status/tools/pack JSON/timestamps/commands.

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-release-artifacts.ts --manifest /tmp/di-bag-release-candidate/candidate.json --work-dir /tmp/di-bag-release-candidate/verify-work`

Expected: exit 0, proving safe extraction and every offline consumer. Preserve both command outputs in `commands.log`.

- [ ] **Step 6: Prepare reviewable tracked evidence without committing.**

```bash
git diff --check
git diff --name-only
```

Expected: the tracked diff contains only the final integration report, sanitized release evidence, and enterprise tracker. The sanitized JSON contains no absolute path or raw log content. Never add tarballs, the detailed manifest/input, extracted packages, verify work, or raw logs to Git/package. Task 5 reviews and commits these three paths once, then regenerates only the ignored detailed manifest with the actual final handoff commit.

### Task 5: Review local handoff and stop

**Files:**
- Modify: `docs/reports/2026-09-08-final-integration-release.md`
- Modify: `docs/reports/2026-09-08-release-candidate-evidence.json`
- Modify: `docs/superpowers/plans/2026-09-06-enterprise-di-program.md`

**Interfaces:**
- Consumes: freeze record, candidate manifest, command log, package contents, verifier, integration report, and final diff.
- Produces: reviewed local handoff naming unavailable registry/publication checks and no external action.

- [ ] **Step 1: Review evidence checklist.**

| Required local fact | Evidence |
| --- | --- |
| Candidate source/version | manifest checkout/commit, `package.json`, changelog heading |
| No box dependency | manifest dependency fields plus core-only consumer |
| Package content/hash | verifier and SHA-256/SHA-512/integrity |
| Source/native/package/type health | exit-0 commands, I1-I15, current reviewed/fresh native-gap inventory comparison |
| Recovery readiness | last-good version, archive hash, corrected-source/new-patch path |
| No external action | command log excludes login/view/whoami/publish/dist-tag/tag/push/credential write |

- [ ] **Step 2: Run final diff and retained-artifact audit.**

Run separately: `git diff --check`; `git diff --name-only`; `git status --short`; `bun test tests/release-artifacts.test.ts`; and `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-release-artifacts.ts --manifest /tmp/di-bag-release-candidate/candidate.json --work-dir /tmp/di-bag-release-candidate/review-work`.

Expected: diff exits 0; the tracked diff contains exactly the three approved evidence paths; status additionally contains only the preserved untracked execution handoff; every release test passes; verifier exits 0 again and confirms the public sanitized projection matches the detailed manifest except for excluded absolute/self-referential fields.

- [ ] **Step 3: Write explicit stop statement.**

State that local evidence is complete; registry availability/owner/access/tag/provenance remains unavailable; no `npm view`, `npm whoami`, `npm login`, `npm publish`, `npm dist-tag`, `git tag`, `git push`, or credential write occurred; fresh explicit authorization is required before online preflight/publication.

- [ ] **Step 4: Commit final local handoff.**

```bash
git add docs/reports/2026-09-08-final-integration-release.md
git add docs/reports/2026-09-08-release-candidate-evidence.json
git add docs/superpowers/plans/2026-09-06-enterprise-di-program.md
git commit -m "docs: complete local release handoff"
```

- [ ] **Step 5: Bind the ignored manifest to final handoff commit and stop.**

After the evidence commit, first run bootstrap `git rev-parse HEAD`, `git diff --name-only <candidateSourceCommit>..<bootstrap-head>`, and `git status --short` records through `scripts/run-release-command.ts` using only the fixed sanitized evidence as a pre-execution input. Parse them to obtain `handoffCommit` and `changedPaths`; update the ignored evidence input and regenerate only `/tmp/di-bag-release-candidate/candidate.json` without `--public-out`.

Then rerun the exact three named Git probes as fresh final records, this time supplying both the regenerated detailed manifest and sanitized evidence as repeated pre-execution `--input` values. Require final HEAD to equal `handoffCommit`, the path diff to equal only the three approved evidence paths, and status to equal only the preserved untracked execution handoff. Require `/tmp/di-bag-release-candidate/final-work` not to exist, then run the complete release-artifact tests and the verifier there one final time through the runner with those same two input hashes. Candidate gate records are manifest-bound; only these rerun postcommit records enter the final audit, so every recorded manifest hash equals the final detailed file. As the final command, run `scripts/create-release-audit.ts` with the exact manifest/public evidence, candidate/final commits, the three final Git records, and final test/verifier records; it must parse and match the Git outputs before atomically writing `/tmp/di-bag-release-candidate/final-audit.json`. Run nothing afterward. The next activity is a separately authorized online runbook beginning with registry preflight; this plan has no such command.

## Plan self-review

- [ ] Candidate, build, pack, hash, extraction, offline consumer, documentation, review, and recovery requirements map to a task.
- [ ] Every path, interface, input, output, expected result, and command is concrete; no incomplete, deferred, or vague implementation instruction remains.
- [ ] Registry availability and login/push/tag/publish are accurately labeled unavailable/separately authorized, with no task command that performs them.
- [ ] The manifest creator accepts only `--input`, `--out`, and the exact optional sanitized `--public-out`; candidate/handoff commits, allowed path diff, branch, status, tools, pack JSON, timestamps, exact argv/cwd/results, and hashed logs are present.
- [ ] Fresh native fingerprint occurrences equal the reviewed inventory or a multiset subset; no new, moved, duplicated, or changed occurrence is accepted, and an empty fresh list is accepted.
- [ ] Final task terminates at local handoff without advancing to network or publication.
