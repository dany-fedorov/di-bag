# Publishing DI Bag

[README](README.md) · [Development checks](docs/guides/development.md) · [Changelog](CHANGELOG.md)

This guide prepares one local `di-bag` release candidate. It does not authorize
or perform registry, authentication, remote Git, tag, or publication work.
Registry version/owner/access/tag/provenance status is unavailable without a
separately authorized online check.

## Authoritative input

Prepare the candidate from the repository root at one recorded, clean commit.
Freeze its package name and version, source commit, branch, package metadata,
tool versions, native diagnostic inventory, build output, dry-run and actual pack
JSON, archive bytes and hashes, and every supervised command record.

Verify the public API and inferred consumer declarations in the packed
archive. The documented local version is `0.4.0`; select and verify each
subsequent version before publication.

Use the absolute, ignored directory `/tmp/di-bag-release-candidate` for archives,
detailed manifests, logs, and isolated consumers. Durable evidence committed to
the repository must omit absolute checkout, archive, and log paths.

## Local candidate workflow

Start from the recorded commit and locked toolchain. Run the source, runtime,
declaration, documentation, native compiler, platform, and release checks that
apply to the candidate. Build before both the dry run and
`npm pack --ignore-scripts`; compare the built tree after each step.

Use the tool versions listed in the [development guide](docs/guides/development.md).
Create the candidate directory if it does not exist. The required local gates are:

```sh
npm ci
npm ci --prefix tools/docs
npm run platform:pin
mkdir -p /tmp/di-bag-release-candidate
npm run check
npm run typecheck:native
npm run build:native
npm run check:native
npm run docs:check
npm run docs:build
bun test tests/final-adversarial-integration.test.ts
bun test tests/package.test.ts
bun test tests/native-package.test.ts
bun run examples/provider-metadata.ts
bun run examples/composition.ts
bun run examples/contributions.ts
bun run examples/modules.ts
bun run examples/observers.ts
bun run examples/plugins.ts
bun run examples/scopes.ts
bun run examples/tokens.ts
bun run examples/wbs-scope.ts
bun test tests/release-artifacts.test.ts
npm run build
npm pack --dry-run
npm run build
npm pack --ignore-scripts --json --pack-destination /tmp/di-bag-release-candidate
```

Run adversarial files serially when the release verifier identifies them as
separately supervised commands. Each file must have its own successful record
and log hashes under the configured memory limit. Create each dry-run preview
and archive only after its explicit build, using `--ignore-scripts` for the
actual pack.

Put the archive in `/tmp/di-bag-release-candidate`. Inspect it as untrusted input
and accept only the documented license, README, package manifest, and
distribution files. Confirm package identity, metadata, file list, byte size,
SHA-256, SHA-512, and npm integrity from the retained archive bytes.

Install the explicit archive path into fresh consumers with:

```sh
npm install --offline --ignore-scripts --no-audit --no-fund --no-package-lock <archive-path>
```

Consumers must exercise the root entry point in CommonJS and ESM under
Node and Bun, compile the physical declarations with producer source removed
under both supported compilers, and prove the archive has zero runtime
dependencies. Any timeout, signal, memory/output bound, changed input,
unexpected diagnostic, archive mismatch, consumer failure, or nonzero exit
rejects the candidate.

The detailed manifest is local evidence. The sanitized committed projection and
final audit bind the reviewed facts without publishing raw logs or absolute paths.
Completion establishes a locally verified candidate only.

## Immutable-version recovery

npm versions are immutable. If a published version is defective, record the
last-good version, the defective archive hash and observed failure, correct the
source on a new commit, increment to a new patch version across all release
facts, rebuild the candidate, and repeat every local gate. Never overwrite or
reuse the defective version. A registry collision, wrong owner, denied access,
failed provenance, or unexpected tag policy stops the later publication session.

## Releasing di-bag-graph

`tools/graph` is the separate package `di-bag-graph`, with its own version,
lockfile, and `typescript` dependency. It reads DI Bag builder chains
syntactically and does not depend on `di-bag`, so the two versions move
independently. Record a tool release in the `CHANGELOG.md` section of the
`di-bag` release it accompanies, naming the tool version.

1. Set `version` in `tools/graph/package.json`; run `npm install --prefix tools/graph`
   to update its lockfile.
2. Run `npm ci --prefix tools/graph` and `npm run graph:check`. The pack test
   asserts the archive holds only `LICENSE`, `README.md`, `cli.mjs`,
   `lib/extract.mjs`, and `package.json`.
3. Run the CI step "Smoke-test the packed graph tool" locally: it installs both
   packed archives into a copy of `tools/graph/test/fixtures/consumer` and runs
   `tsc` and `npx di-bag-graph --check` there.
4. `npm pack ./tools/graph --pack-destination /tmp/di-bag-release-candidate` and
   inspect the archive.
5. Publication of that archive falls under the authorization rule below: the
   same registry check, public access, and provenance as `di-bag`, only in a
   separately authorized session.

## DO NOT RUN without fresh explicit authorization

```bash
npm view di-bag@0.4.0 version --registry=https://registry.npmjs.org
npm login --registry=https://registry.npmjs.org
npm publish /tmp/di-bag-release-candidate/di-bag-0.4.0.tgz --access public --provenance
npm dist-tag add di-bag@0.4.0 latest --registry=https://registry.npmjs.org
```
