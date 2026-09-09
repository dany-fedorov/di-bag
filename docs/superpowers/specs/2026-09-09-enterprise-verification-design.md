# Enterprise verification and framework parity

The authorized enterprise review continues the existing program. The feature
implementation already covers providers, modules, tokens, lifetimes, startup,
ownership, aliases, optional/lazy dependencies, contributions and plugins.
The remaining review must compare these capabilities explicitly with NestJS and
Angular and preserve any semantic differences in the published result.

## Design

Use the existing package/platform oracles and add reproducible provisioning and
CI. Reimplementing the platform harness would duplicate its archive and import
isolation guarantees. Adding only CI configuration would leave execution
unproven. The selected approach provisions exact development tool versions,
captures their actual executable hashes on each host, and runs the existing
oracles both locally and in CI.

`tools/platform/package.json` and its lockfile own Deno, esbuild and Playwright
development dependencies separately from the published zero-dependency package.
Playwright owns the matching Chromium revision. A pinning command discovers
installed tools, verifies expected versions and writes an ignored
`tools/platform-versions.local.json`. Foundation-only pinning explicitly marks
portable tools unavailable; `--all` requires every tool. The existing tracked
manifest remains historical fallback. A present invalid local manifest fails;
it must never silently fall back to another machine's identity.

The platform collector keeps its informational default. Its new `--required`
mode succeeds only for exactly one passing archive, Deno and browser Worker row
in canonical order. CI uses this strict mode, installs the locked tooling and
Chromium, runs source/native/package checks serially, and retains platform
evidence as a workflow artifact. Workflow permissions are read-only; the
workflow does not publish packages or write repository contents.

Research uses upstream first-party sources and repository test evidence. DI
capability equivalents, intentional differences, framework integration gaps
and actual missing behavior must be distinguished. Framework-wide parity and
untested NestJS/Angular integration must not be claimed.

The comparison also motivates a transport-neutral integration recipe. Keep it
in `examples/integration` so it is explicitly application code, not a new core
registry or ambient injector. An owned-scope executor accepts a callback that
creates the bag/scope and a typed work callback, always awaits close, and preserves
both handler and cleanup failures. Tests combine concurrent request overrides,
private modules, shared root ownership, abort-on-close, test substitutions and an
actual dynamic import with contributions. A guide maps these contracts to Nest
request/testing boundaries and Angular environment/component ownership.

## Acceptance

- Regression tests reject missing, duplicate, unavailable and failed required
  rows, invalid local manifests, version mismatches and failed version probes.
- Existing platform validation and process/packaging behavior remain intact.
- The real locally packed archive executes in Deno and a minified Chromium
  Worker; failing execution remains a failure, never an unavailable success.
- Classic and native compiler gates, source/package tests and runnable examples
  pass after changes. Compiler-heavy commands run serially.
- Publish a cited parity matrix and an evidence-backed readiness review; resolve
  actionable review findings before committing and pushing `feat/v0.1`.
- Preserve the existing untracked execution handoff. No registry publication,
  source tag or secret/credential change is part of this request.
