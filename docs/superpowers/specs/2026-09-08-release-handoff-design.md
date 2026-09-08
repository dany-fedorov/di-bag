# DI Bag release-candidate handoff design

This handoff turns a locally verified DI Bag release candidate into complete, reviewable local evidence. It starts after adversarial integration is green and stops before registry access, authentication, remote Git mutation, tag creation, or publication. It does not claim `0.1.0` availability: package-name/version availability, access policy, maintainer state, provenance, and registry ownership are unavailable without separately authorized online preflight.

## Candidate inputs and freeze rule

Only these checkouts provide release evidence:

| Package | Required checkout | Required revision |
| --- | --- | --- |
| `di-bag` | repository root | frozen candidate `HEAD`, recorded in manifest |
| `sas-box` | `.related-repos/sas-box` | `b895f9d1f1d168992f44e9f46025bc1ac9d26e14` unless reviewed candidate supersedes it |
| `val-box` | `.related-repos/val-box` | `07506fcb3e49f460b6de357ecad7d88262a7f32d` unless reviewed candidate supersedes it |

Similarly named directories outside `.related-repos` are not release inputs. Complete every tracked source, test, script, package, README, changelog, migration, and publishing-guide edit before freezing. Before build, record absolute path, branch, candidate source `HEAD`, exact `git status --short`, Node/npm/Bun/compiler versions, and manifest name/version. The two box trees must be clean. DI Bag may contain only the intentionally preserved untracked execution handoff; modified source, tests, scripts, manifests, lockfiles, build inputs, or package documentation invalidate the freeze. A source revision or version change invalidates later evidence and restarts it.

Evidence documents are committed only after the frozen commands and archives exist. The final ignored manifest therefore records both `candidateSourceCommit` and `handoffCommit`. Their path-level diff must contain only `docs/reports/2026-09-08-final-integration-release.md`, `docs/reports/2026-09-08-release-candidate-evidence.json`, and `docs/superpowers/plans/2026-09-06-enterprise-di-program.md`; any other post-freeze path invalidates the candidate. The committed sanitized evidence JSON omits absolute paths, raw logs, the self-referential final commit, and its observed diff, but retains candidate commits, versions, archive hashes/integrity/bytes/file lists, exact command argv/result/log hashes, native fingerprints, and the constant approved handoff-path allowlist. The ignored manifest and logs retain the final handoff commit and observed path diff as detailed local evidence.

DI Bag declares `version: "0.1.0"` while `CHANGELOG.md` begins `Unreleased`. Reconcile locally: changelog release heading must exactly equal frozen manifest version and new `PUBLISHING.md` describes local evidence plus authorization boundary. An earlier availability report is not a reservation.

## Package relationship

DI Bag has zero runtime, peer, optional, and bundled dependencies. `di-bag/sas-box` and `di-bag/val-box` are structural adapters; neither box may appear in `dependencies`, `peerDependencies`, `optionalDependencies`, or `bundledDependencies`. The boxes remain independent of DI Bag. Three-package consumers prove real composition; core-only consumer proves root DI Bag neither installs nor loads a box or Node runtime.

## Local gates and retained evidence

Use one ignored candidate artifact directory containing `release-evidence-input.json`, `candidate.json`, `commands.log`, extracted packages, and temporary offline consumers. `commands.log` contains stdout/stderr and exit status but no secrets. The supplied input schema is the single source for both scripts:

```ts
type ReleaseEvidenceInput = Readonly<{
  schemaVersion: 1;
  generatedAt: string;
  artifactDirectory: '/tmp/di-bag-release-candidate';
  tools: Readonly<{ node: string; npm: string; bun: string; classic6: string; native7: string;
    sasBoxTypeScript: '5.9.3'; valBoxTypeScript: '5.9.3' }>;
  nativeDiagnostics: Readonly<{ reviewedAt: string;
    reviewedGaps: readonly NativeGapFingerprint[]; freshGaps: readonly NativeGapFingerprint[] }>;
  handoff: Readonly<{ candidateSourceCommit: string; handoffCommit: string;
    changedPaths: readonly string[] }>;
  packages: readonly Readonly<{
    name: 'di-bag' | 'sas-box' | 'val-box'; version: string; archive: string;
    checkout: Readonly<{ path: string; branch: string; candidateSourceCommit: string; status: string }>;
    pack: Readonly<{ dryRunJson: unknown; packJson: unknown; packedAt: string }>;
    commands: readonly ReleaseCommandEvidence[];
  }>[];
}>;

type NativeGapFingerprint = Readonly<{
  id: string; fixture: string; markerLine: number; markerOccurrence: number;
  code: number; normalizedMessage: string; fingerprint: string;
}>;

type ReleaseCommandEvidence = Readonly<{
  argv: readonly string[]; cwd: string; startedAt: string; finishedAt: string; elapsedMilliseconds: number;
  exitCode: 0; signal: null; terminationReason: null;
  inputs: readonly Readonly<{ path: string; bytes: number; sha256: string }>[];
  stdout: Readonly<{ path: string; bytes: number; sha256: string }>;
  stderr: Readonly<{ path: string; bytes: number; sha256: string }>;
}>;
```

The manifest creator reads `--input /tmp/di-bag-release-candidate/release-evidence-input.json` and writes `--out /tmp/di-bag-release-candidate/candidate.json`. It derives archive byte size, SHA-256, SHA-512, npm integrity, file list, and extracted metadata from the recorded local archive and `packJson`; it rejects a missing or inconsistent input field. The verifier reads that candidate manifest through `--manifest` and takes only `--work-dir` for its fresh local extraction/consumer work.

`scripts/run-release-command.ts` is the only evidence-command launcher. It accepts canonical artifact directory, record path, cwd, zero or more pre-execution input files to hash, and argv after `--`, never a shell string. It uses the existing supervisor with fixed 900-second, 4096-MiB observed-process RSS, 16-MiB combined-output, and 20-ms sampling limits; atomically writes stdout/stderr and the normalized evidence record beneath the artifact directory; and rejects spawn, signal, timeout, memory, output, monitor, or log-write failure. It also rejects registry/authentication/publication/remote-Git command tokens. Candidate commands are manifest-bound. Precommit and postcommit review records remain in the ignored command log; each final verifier record hashes its detailed manifest and fixed sanitized evidence input before execution, avoiding any claim that a manifest attests to the verifier currently reading it.

`scripts/release-native-inventory.ts` is the authoritative inventory generator. It reads the committed native-gap declarations under `tests/types`, the exact fingerprint table used by `tests/native-diagnostic-markers.ts`, and the fresh JSONL emitted by the retained `npm run check:native` command. It requires exactly 27 reviewed occurrences at this checkpoint, recomputes every SHA-256 fingerprint from fixture, marker line/occurrence, code, and normalized message, and emits sorted reviewed/fresh arrays. Missing, extra, moved, duplicate, or changed occurrences fail.

`scripts/create-release-audit.ts` performs the final non-self-referential binding. After the evidence-only handoff commit, it validates the actual candidate-to-handoff path diff and completed postcommit command records, requires those records to carry pre-execution hashes of the detailed manifest and fixed sanitized evidence, and atomically writes the ignored `final-audit.json`. The candidate manifest attests only to candidate gates; the final audit attests to the later local review commands and the exact manifest bytes they inspected.

`scripts/hash-release-tree.ts` reads each regular file under one candidate's `dist` exactly once and atomically writes sorted relative path, byte count, and SHA-256 records. Symlinks, special files, traversal, output aliasing, empty trees, or mutation reject. Each package records byte-identical tree evidence immediately after explicit build, after dry-run/prepack, and after actual packing, so pack agreement cannot hide a prepack rewrite.

`scripts/create-release-manifest.ts` validates the supplied evidence input and creates deterministic manifest JSON. It rejects relative, prefix-collision, noncanonical, symlink-escaping, or replaced archive/log paths; duplicate packages or gap occurrences; version mismatch; missing branch/status/commit/tool/pack/timestamp/command evidence; invalid ISO or reverse-ordered timestamps, negative/mismatched elapsed time; missing, empty-required, outside-artifact, changed, or duplicate logs; any fresh native fingerprint absent from the reviewed multiset; and any post-freeze path outside the evidence allowlist. It derives normalized extracted package metadata (name, version, exports, files, main/types, and every dependency/bundle map) and checks dry-run/actual pack filename, name, version, size, unpacked size, shasum, integrity, and sorted file-entry equality. `scripts/verify-release-artifacts.ts` read-only validates bytes, npm integrity, metadata, declared files, the fixed sanitized projection located through the recorded DI Bag checkout, and fresh offline consumers. Neither script contains network client code or accepts credentials, registry URL, tag, publish, login, push, or Git-mutation options.

Archive validation happens on bytes read once from an opened regular file. Inspect gzip/tar structure before extraction; reject truncation, absolute or traversal names, prefix collisions, duplicate entries, symlinks, hardlinks, devices, FIFOs, oversized entries, and non-regular/non-directory headers. Stop before extraction or consumers on any structural, hash, integrity, metadata, or content failure. Archive contents require license, README, `package.json`, and `dist/**` only. Box candidates have five `sas-box` and seven `val-box` expected packed files. Fixture SHA-512 comparison is allowed only if frozen revision and pack inputs match. DI Bag has `files: ['dist']` and must emit public `dist/index`, `dist/node`, `dist/sas-box`, `dist/val-box` JS/declaration pairs. Reject tests, fixture `.tgz`, `node_modules`, source, credentials, scratch, or unpublished subpaths.

## Required local sequence

From frozen DI Bag run each gate separately through the command launcher: `npm run check`, `npm run typecheck:native`, `npm run build:native`, `npm run check:native`, and four separately supervised adversarial commands: `bun test tests/final-adversarial-integration.test.ts`, `bun test tests/box-package.test.ts`, `bun test tests/package.test.ts`, and `bun test tests/native-package.test.ts`. Each adversarial file requires its own successful command record and retained log hashes under the fixed 4096 MiB observed-process RSS limit. Then run `bun run` for exactly `box-adapters.ts`, `composition.ts`, `contributions.ts`, `modules.ts`, `observers.ts`, `plugins.ts`, `scopes.ts`, `tokens.ts`, and `wbs-scope.ts` in sorted order. Reject missing, extra, duplicate, or reordered discovery. Native permits no unexpected diagnostic and requires the fresh fingerprint multiset to equal the current reviewed inventory or a strict subset, allowing all prior gaps to disappear while rejecting new, moved, duplicated, or changed diagnostics. Run documented local `npm run check` and package consumer tests from frozen box candidates and record each checkout's exact local TypeScript 5.9.3 executable/version. Build and dry-run each box candidate. Rebuild DI Bag with classic TypeScript immediately before its dry-run and actual pack so the archive cannot inherit the preceding native build. For every package compare dry-run and actual pack file lists, then run `npm pack --ignore-scripts --json --pack-destination /tmp/di-bag-release-candidate`. Extract, inspect, hash, and use explicit tarball paths in fresh `npm install --offline --ignore-scripts --no-audit --no-fund --no-package-lock` consumers.

The initial Task 4 execution rejected two attempts to run all four adversarial files in one Bun invocation because the supervisor terminated both for exceeding 4096 MiB. The runner deliberately removed incomplete records, so those failed attempts have no recoverable exact elapsed or peak values. Separately supervised diagnostics established the cause without weakening the limit: final adversarial used 53.4609375 MiB over 161 ms (13 tests, 13 assertions), box package used 3465.125 MiB over 87,928 ms (121 tests, 345 assertions), package used 3315.19921875 MiB over 59,698 ms (79 tests, 497 assertions), and native package used 1541.6796875 MiB over 163,614 ms (2 tests, 1,210 assertions). No matching Bun, npm, or TypeScript process survived either rejected attempt. The four-command serial requirement preserves the intended coverage while giving every memory-heavy file an independent bound, result, and hash.

Consumers cover all root/node/sas-box/val-box CJS/ESM imports under both Node and Bun, exact I1-I15 real three-package composition, core-only no-box installation plus root import-graph isolation, and source-deleted declarations under pinned classic TypeScript 6 and native TypeScript 7 with `skipLibCheck: false`. Final review reads manifest, command log, committed sanitized evidence, full candidate-to-handoff path diff, package contents, and matrix report; `git diff --check` exits zero. It repeats the complete release-artifact tests and verifier after all tracked evidence edits. Recovery identifies last-good version, defective hash, and corrected-source/new-patch route because npm versions are immutable.

## Explicit stop boundary

The plan ends after local artifacts, hashes, manifest, offline logs, documentation, and review evidence. `npm view`, `npm whoami`, `npm login`, provenance queries, `npm publish`, `npm dist-tag`, `git tag`, `git push`, and credential writes are unavailable and out of scope. A later registry lookup is evidence, not a reservation; collision, wrong owner, access failure, provenance failure, or tag-policy mismatch is a hard stop before publication.

`PUBLISHING.md` documents, but this handoff never executes, the following exact commands beneath `DO NOT RUN without fresh explicit authorization`:

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
