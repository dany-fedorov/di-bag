# DI Bag release-candidate handoff design

This handoff turns a locally verified DI Bag release candidate into complete, reviewable local evidence. It starts after adversarial integration is green and stops before registry access, authentication, remote Git mutation, tag creation, or publication. It does not claim `0.1.0` availability: package-name/version availability, access policy, maintainer state, provenance, and registry ownership are unavailable without separately authorized online preflight.

## Candidate inputs and freeze rule

Only these checkouts provide release evidence:

| Package | Required checkout | Required revision |
| --- | --- | --- |
| `di-bag` | repository root | frozen candidate `HEAD`, recorded in manifest |
| `sas-box` | `.related-repos/sas-box` | `b895f9d1f1d168992f44e9f46025bc1ac9d26e14` unless reviewed candidate supersedes it |
| `val-box` | `.related-repos/val-box` | `07506fcb3e49f460b6de357ecad7d88262a7f32d` unless reviewed candidate supersedes it |

Similarly named directories outside `.related-repos` are not release inputs. Before build, record absolute path, branch, `HEAD`, `git status --short`, Node/npm/Bun/compiler versions, manifest name/version, and SHA-256/SHA-512 of every tarball. Trees must be clean apart from reviewed release documentation and ignored artifact outputs. A source revision or version change invalidates later evidence and restarts freeze.

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
  tools: Readonly<{ node: string; npm: string; bun: string; classic6: string; native7: string }>;
  nativeDiagnostics: Readonly<{ reviewedAt: string; reviewedGapIds: readonly string[]; freshGapIds: readonly string[] }>;
  packages: readonly Readonly<{
    name: 'di-bag' | 'sas-box' | 'val-box'; version: string; archive: string;
    checkout: Readonly<{ path: string; branch: string; commit: string; status: string }>;
    pack: Readonly<{ dryRunJson: unknown; packJson: unknown; packedAt: string }>;
    commands: readonly Readonly<{ command: string; startedAt: string; finishedAt: string; exitCode: 0; stdoutPath: string; stderrPath: string }>[];
  }>[];
}>;
```

The manifest creator reads `--input /tmp/di-bag-release-candidate/release-evidence-input.json` and writes `--out /tmp/di-bag-release-candidate/candidate.json`. It derives archive byte size, SHA-256, SHA-512, npm integrity, file list, and extracted metadata from the recorded local archive and `packJson`; it rejects a missing or inconsistent input field. The verifier reads that candidate manifest through `--manifest` and takes only `--work-dir` for its fresh local extraction/consumer work.

`scripts/create-release-manifest.ts` validates the supplied evidence input and creates deterministic manifest JSON. It rejects relative paths, duplicate packages, version mismatch, missing branch/status/commit/tool/pack/timestamp/command evidence, a native gap ID not in the reviewed inventory, and archives outside artifact directory. `scripts/verify-release-artifacts.ts` read-only validates bytes, npm integrity, metadata, declared files, and fresh offline consumers. Neither script contains network client code or accepts credentials, registry URL, tag, publish, login, push, or Git-mutation options.

Archive validation requires license, README, `package.json`, and `dist/**` only. Box candidates have five `sas-box` and seven `val-box` expected packed files. Fixture SHA-512 comparison is allowed only if frozen revision and pack inputs match. DI Bag has `files: ['dist']` and must emit public `dist/index`, `dist/node`, `dist/sas-box`, `dist/val-box` JS/declaration pairs. Reject tests, fixture `.tgz`, `node_modules`, source, credentials, scratch, or unpublished subpaths.

## Required local sequence

From frozen DI Bag run `npm run check`, `npm run typecheck:native`, `npm run build:native`, `npm run check:native`, all nine `bun run examples/*.ts`, and final source/package/native adversarial suite. Native permits no unexpected diagnostic and requires the fresh gap ID list to equal the current reviewed inventory or a strict subset, allowing the prior 27 IDs to become zero while rejecting every new ID or changed fingerprint. Run documented local `npm run check` and package consumer tests from frozen box candidates. Build each candidate, run `npm pack --dry-run --json`, then `npm pack --ignore-scripts --json --pack-destination /tmp/di-bag-release-candidate`. Extract, inspect, hash, and use explicit tarball paths in fresh `npm install --offline --ignore-scripts --no-audit --no-fund --no-package-lock` consumers.

Consumers cover root/node/sas-box/val-box CJS/ESM imports, real three-package composition, core-only no-box installation, and classic/native declarations with `skipLibCheck: false`. Final review reads manifest, command log, full diff, package contents, and matrix report; `git diff --check` exits zero. Recovery identifies last-good version, defective hash, and corrected-source/new-patch route because npm versions are immutable.

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
