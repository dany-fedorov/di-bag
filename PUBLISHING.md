# Publishing DI Bag and its box adapters

This guide prepares a local release candidate. It does not authorize or perform
registry, authentication, remote Git, tag, or publication work.
Registry version/owner/access/tag/provenance status is unavailable without
authorization for a separate online check.

## Authoritative inputs

Prepare the three candidates only from these checkouts:

- the repository root for `di-bag`;
- `.related-repos/sas-box` for `sas-box`;
- `.related-repos/val-box` for `val-box`.

For every candidate, freeze its package name and version, candidate source commit,
branch, clean status, package metadata, tool versions, native diagnostic inventory,
build output, dry-run and actual pack JSON, archive bytes and hashes, and every
supervised command record. The DI Bag handoff also freezes the candidate commit,
the later evidence-only commit, and the allowed evidence paths between them.

Use the absolute, ignored directory `/tmp/di-bag-release-candidate` for archives,
detailed manifests, logs, and isolated consumers. Durable evidence committed to
the repository must omit absolute checkout, archive, and log paths.

## Local candidate workflow

Start from clean checkouts at the recorded commits. Build each package before its
dry run and before `npm pack --ignore-scripts`; compare the built tree after each
step. Run each package's documented checks with its local, locked toolchain. For
DI Bag, run the classic and native source/build gates, the exact native diagnostic
inventory, the final adversarial source/archive matrix, all nine examples, and the
release-artifact tests.

The required DI Bag local gates are:

```sh
npm run check
npm run typecheck:native
npm run build:native
npm run check:native
bun test tests/final-adversarial-integration.test.ts tests/box-package.test.ts tests/package.test.ts tests/native-package.test.ts
bun run examples/box-adapters.ts
bun run examples/composition.ts
bun run examples/contributions.ts
bun run examples/modules.ts
bun run examples/observers.ts
bun run examples/plugins.ts
bun run examples/scopes.ts
bun run examples/tokens.ts
bun run examples/wbs-scope.ts
bun test tests/release-artifacts.test.ts
```

Run the corresponding documented check and build in each box checkout. Record
every gate through the release command supervisor; do not substitute one combined
command for a missing individual record. Create each dry-run preview and actual
archive only after its explicit build, using `--ignore-scripts` for the actual pack.

The pack destination must be `/tmp/di-bag-release-candidate`. Inspect every archive
as untrusted input and accept only the documented license, README, package manifest,
and distribution files. Confirm package identity, metadata, file list, byte size,
SHA-256, SHA-512, and npm integrity from the retained archive bytes.

Install only explicit archive paths into fresh consumers with:

```sh
npm install --offline --ignore-scripts --no-audit --no-fund --no-package-lock <archive-path>...
```

Those consumers must exercise the root, Node, sas-box, and val-box entry points in
CommonJS and ESM under Node and Bun; compile physical declarations with producer
source removed under both supported compilers; run the full I1-I15 oracle; and
prove that a core-only installation has no box dependency or Node facade import.
Any timeout, signal, memory/output bound, changed input, unexpected diagnostic,
archive mismatch, consumer failure, or nonzero exit rejects the candidate.

The detailed manifest is local evidence. The sanitized committed projection and
final audit bind the reviewed facts without publishing raw logs or absolute paths.
Completion of this workflow establishes only a locally verified candidate.

## Immutable-version recovery

npm versions are immutable. If a published version is defective, record the
last-good version, the defective archive hash and observed failure, correct the
source on a new commit, increment to a new patch version across all release facts,
rebuild all three candidates, and repeat every local gate. Never overwrite or
reuse the defective version. A registry collision, wrong owner, denied access,
failed provenance, or unexpected tag policy stops the later publication session.

## DO NOT RUN without fresh explicit authorization

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
