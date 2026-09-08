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
- Stop before `npm view`, `npm whoami`, `npm login`, `npm publish`, `npm dist-tag`, `git tag`, `git push`, or credential write. Registry checks are unavailable in this plan.

---

## File structure

| File | Responsibility |
| --- | --- |
| `PUBLISHING.md` | Local candidate workflow, authorization boundary, immutable-version recovery. |
| `CHANGELOG.md` | Release heading matching frozen `package.json` version. |
| `README.md` | Export, adapter/no-box-dependency, and local verification guidance. |
| `docs/migrations/0.1-to-enterprise.md` | Raw/native, scope, adapter, observer, plugin ownership migration rules. |
| `scripts/create-release-manifest.ts` | Validate explicit local inputs and write deterministic candidate JSON. |
| `scripts/verify-release-artifacts.ts` | Read-only archive/hash/metadata/content/offline-consumer verifier. |
| `tests/release-artifacts.test.ts` | TDD acceptance/rejection coverage for scripts/docs. |
| `docs/reports/2026-09-08-final-integration-release.md` | Local commands, matrix, hashes, stop statement. |
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
- Modify: `tests/release-artifacts.test.ts`

**Interfaces:**
- Consumes: `--input /tmp/di-bag-release-candidate/release-evidence-input.json` and `--out /tmp/di-bag-release-candidate/candidate.json`.
- Produces: `ReleaseManifest` from one supplied evidence schema containing package commit/branch/status, tool versions, dry-run/pack JSON, timestamps, and command logs plus derived immutable archive facts.

- [ ] **Step 1: Write failing manifest-input tests.**

```ts
expect(() => parseManifestArgs(['--input', 'relative', '--out', '/tmp/candidate.json']))
  .toThrow('evidence input must be absolute');
expect(() => parseManifestArgs([
  '--input', '/tmp/release/release-evidence-input.json', '--out', '/tmp/candidate.json',
  '--package', 'di-bag=/tmp/a.tgz',
])).toThrow('unsupported option: --package');
```

Also test input rejection for duplicate package record, archive outside artifact directory, missing branch/status/commit/tool/pack JSON/timestamp/command output path, a nonzero command result, fresh native gap ID absent from reviewed inventory, and recorded version differing from `package/package.json`.

- [ ] **Step 2: Run manifest tests to verify RED.**

Run: `bun test tests/release-artifacts.test.ts -t "manifest"`

Expected: FAIL because parser/writer do not exist.

- [ ] **Step 3: Implement exact types and deterministic writer.**

```ts
export type ReleasePackageRecord = Readonly<{
  name: 'di-bag' | 'sas-box' | 'val-box'; version: string; archive: string;
  checkout: Readonly<{ path: string; branch: string; commit: string; status: string }>;
  pack: Readonly<{ dryRunJson: unknown; packJson: unknown; packedAt: string }>;
  commands: readonly Readonly<{ command: string; startedAt: string; finishedAt: string; exitCode: 0; stdoutPath: string; stderrPath: string }>[];
  integrity: string; sha256: string; sha512: string; bytes: number; files: readonly string[];
}>;
export type ReleaseManifest = Readonly<{
  schemaVersion: 1; artifactDirectory: string; generatedAt: string;
  tools: Readonly<{ node: string; npm: string; bun: string; classic6: string; native7: string }>;
  nativeDiagnostics: Readonly<{ reviewedAt: string; reviewedGapIds: readonly string[]; freshGapIds: readonly string[] }>;
  packages: readonly ReleasePackageRecord[];
}>;
```

Add the supplied input type before `ReleaseManifest`:

```ts
export type ReleaseEvidenceInput = Readonly<{
  schemaVersion: 1; generatedAt: string; artifactDirectory: '/tmp/di-bag-release-candidate';
  tools: Readonly<{ node: string; npm: string; bun: string; classic6: string; native7: string }>;
  nativeDiagnostics: Readonly<{ reviewedAt: string; reviewedGapIds: readonly string[]; freshGapIds: readonly string[] }>;
  packages: readonly Readonly<{ name: 'di-bag' | 'sas-box' | 'val-box'; version: string; archive: string;
    checkout: Readonly<{ path: string; branch: string; commit: string; status: string }>;
    pack: Readonly<{ dryRunJson: unknown; packJson: unknown; packedAt: string }>;
    commands: readonly Readonly<{ command: string; startedAt: string; finishedAt: string; exitCode: 0; stdoutPath: string; stderrPath: string }>[]; }> [];
}>;
```

Use `realpathSync`, `statSync`, `createHash`, and supplied `packJson`. Sort package records/files lexically. Require exactly the three package names and reject missing/duplicate facts. Fresh native IDs must be a subset of reviewed IDs. Do not invoke npm, Git, or a network client; record supplied local facts only.

- [ ] **Step 4: Run manifest tests to verify GREEN.**

Run: `bun test tests/release-artifacts.test.ts -t "manifest"`

Expected: PASS; equivalent inputs serialize identically and every invalid input has its stated rejection.

- [ ] **Step 5: Commit manifest task.**

```bash
git add scripts/create-release-manifest.ts tests/release-artifacts.test.ts
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

Cover five/seven box entry totals, DI Bag `files: ['dist']`, missing root/node/sas-box/val-box pairs, changed integrity, test/source/fixture/node_modules/credential content, and unexpected box in core-only consumer.

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
  await verifyOfflineConsumers(manifest, workDir, failures);
  return { ok: failures.length === 0, failures };
}
```

Hash exact bytes; inspect `package/package.json` and paths; compare contents. Three-package consumer executes Node `require('di-bag/node')`, ESM `di-bag/node`, public `fromSasBox`/`fromValBox` real-box composition, and declarations with `skipLibCheck: false`. Core-only consumer runs `import('di-bag')` and asserts both box directories absent. Only execute offline install with explicit tarballs.

- [ ] **Step 4: Run verifier tests to verify GREEN.**

Run: `bun test tests/release-artifacts.test.ts -t "archive verifier"`

Expected: PASS valid fixture and reject every tampering/content/core-only case.

- [ ] **Step 5: Verify CLI scope.**

Run: `node scripts/verify-release-artifacts.ts --help`

Expected: usage lists only `--manifest` and `--work-dir`; no login, publish, tag, registry, credential, push, or remote option.

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
- Modify: `docs/reports/2026-09-08-final-integration-release.md`

**Interfaces:**
- Consumes: Tasks 1-3, final integration suite, frozen root/related-repository checkouts.
- Produces: local manifest/log/report with exact commit/branch/status/version/hash/tool/pack/timestamp/command evidence and no remote evidence.

- [ ] **Step 1: Capture and validate freeze inputs.**

Run: `git rev-parse --show-toplevel; git branch --show-current; git rev-parse HEAD; git status --short; node --version; npm --version; bun --version`

Expected: paths match spec; sas-box begins `b895f9d1f1d168992f44e9f46025bc1ac9d26e14`; val-box begins `07506fcb3e49f460b6de357ecad7d88262a7f32d`; status is clean except reviewed docs/manifest/ignored outputs. Run from all three authoritative checkouts and record branch, commit, status, command start/finish timestamps, stdout path, stderr path, and exit code in `release-evidence-input.json`.

- [ ] **Step 2: Run DI Bag source/native/integration/example gates serially.**

Run: `npm run check && npm run typecheck:native && npm run build:native && npm run check:native && for file in examples/*.ts; do bun run "$file"; done && bun test tests/final-adversarial-integration.test.ts tests/box-package.test.ts tests/package.test.ts tests/native-package.test.ts`

Expected: every exit 0; no timeout/OOM/synthetic supervisor/skip; native has zero unexpected diagnostics and fresh gap IDs equal reviewed IDs or a strict subset, including zero. Record both lists and review timestamp in `nativeDiagnostics`.

- [ ] **Step 3: Run frozen box gates and build before packing.**

Run in each related checkout: `npm run check && npm run build && npm pack --dry-run --json`

Expected: exit 0; sas-box list has five entries and val-box seven; pack input commits match freeze record. Preserve each dry-run JSON, pack JSON, command timestamps, and output paths in that package's evidence record.

- [ ] **Step 4: Pack all candidates to explicit local artifact directory.**

Run after build: `npm pack --ignore-scripts --json --pack-destination /tmp/di-bag-release-candidate`

Expected: one tarball per candidate with JSON filename/integrity/files; no prepack changes built output.

- [ ] **Step 5: Write the supplied evidence input, then create and verify manifest.**

Write `/tmp/di-bag-release-candidate/release-evidence-input.json` with exactly one `packages` entry for `di-bag`, `sas-box`, and `val-box`; all must include the schema fields defined in Task 2. Its `artifactDirectory` is exactly `/tmp/di-bag-release-candidate`; each archive is the tarball produced by Step 4; every `commands` entry has `exitCode: 0` and references retained stdout/stderr files under that directory.

Run: `node scripts/create-release-manifest.ts --input /tmp/di-bag-release-candidate/release-evidence-input.json --out /tmp/di-bag-release-candidate/candidate.json`

Expected: exit 0 and manifest includes SHA-256/SHA-512/integrity/bytes/files plus supplied branch/commit/status/tools/pack JSON/timestamps/commands.

Run: `node scripts/verify-release-artifacts.ts --manifest /tmp/di-bag-release-candidate/candidate.json --work-dir /tmp/di-bag-release-candidate/verify-work`

Expected: exit 0, proving extraction and offline consumers. Preserve both command outputs in `commands.log`.

- [ ] **Step 6: Commit only report/tracker evidence.**

```bash
git add docs/reports/2026-09-08-final-integration-release.md docs/superpowers/plans/2026-09-06-enterprise-di-program.md
git commit -m "docs: record local release candidate handoff"
```

Never add tarballs, manifest, extracted packages, verify work, or log to Git/package.

### Task 5: Review local handoff and stop

**Files:**
- Modify: `docs/reports/2026-09-08-final-integration-release.md`

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

Run: `git diff --check && git status --short && node scripts/verify-release-artifacts.ts --manifest /tmp/di-bag-release-candidate/candidate.json --work-dir /tmp/di-bag-release-candidate/review-work`

Expected: diff exits 0; status has reviewed source/docs plus ignored artifacts; verifier exits 0 again.

- [ ] **Step 3: Write explicit stop statement.**

State that local evidence is complete; registry availability/owner/access/tag/provenance remains unavailable; no `npm view`, `npm whoami`, `npm login`, `npm publish`, `npm dist-tag`, `git tag`, `git push`, or credential write occurred; fresh explicit authorization is required before online preflight/publication.

- [ ] **Step 4: Commit final local handoff.**

```bash
git add docs/reports/2026-09-08-final-integration-release.md
git commit -m "docs: complete local release handoff"
```

- [ ] **Step 5: Stop before external operation.**

Run no further command. The next activity is a separately authorized online runbook beginning with registry preflight; this plan has no such command.

## Plan self-review

- [ ] Candidate, build, pack, hash, extraction, offline consumer, documentation, review, and recovery requirements map to a task.
- [ ] Every path, interface, input, output, expected result, and command is concrete; no incomplete, deferred, or vague implementation instruction remains.
- [ ] Registry availability and login/push/tag/publish are accurately labeled unavailable/separately authorized, with no task command that performs them.
- [ ] The manifest creator accepts only `--input /tmp/di-bag-release-candidate/release-evidence-input.json --out /tmp/di-bag-release-candidate/candidate.json`; commit, branch, status, tools, pack JSON, timestamps, and commands are present for every package.
- [ ] Fresh native gap IDs equal the reviewed inventory or a strict subset, no fresh ID/fingerprint is new, and an empty fresh list is accepted.
- [ ] Final task terminates at local handoff without advancing to network or publication.
