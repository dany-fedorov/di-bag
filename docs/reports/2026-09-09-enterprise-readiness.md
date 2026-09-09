# Enterprise readiness review and implementation

The reviewed DI feature set has broad capability parity with NestJS, Angular,
Awilix, InversifyJS, TSyringe, Typed Inject and Effect within DI Bag's documented
model. The [cited comparison](../research/2026-09-09-enterprise-parity.md) records
each capability, implementation/test evidence and semantic differences. This is
DI capability parity, not framework-wide equivalence or a production workload
certification. Direct NestJS/Angular adapters are not shipped.

The review began at `fee5a423ddc1d1454503044c54f5bce27ea02b98` on `feat/v0.1`.
Most enterprise core implementation and the previous release handoff were already
present. The linked Claude artifact could not be opened; repository specs, code,
tests and first-party upstream sources supplied the review evidence.

## Findings and implemented improvements

| Finding | Result |
| --- | --- |
| NestJS and Angular were missing from the published comparison | Added two feature matrices, detailed framework comparisons, exact repository evidence and explicit equivalents/differences. |
| No CI workflow enforced the existing contracts | Added immutable action pins, read-only permissions, Node/Bun/classic/native checks and a separate required portable job. |
| Deno and browser lanes were never provisioned | Added a private locked tooling package, host-specific version/hash capture, actual Deno execution and an esbuild-minified Chromium Worker run. |
| Informational platform exit status accepted unavailable lanes | Added `check:platform`; required mode rejects unavailable, missing, duplicate, reordered and failed rows. Informational collection retains its documented behavior. |
| Test expectations assumed portable tools were always absent | Kept explicit unavailable fixtures and made repository integration tests require successful execution of every provisioned lane. |
| Installed tool evidence could report an inconsistent or nonnumeric version | Added rejecting regressions, numeric version admission and agreement with the actual version output. Local manifest errors do not fall back silently. |
| Executable byte copying made Chromium hashing take about 14 seconds under Bun | A view of the same 293,285,184 bytes produced the identical hash in 160 ms. Version probes are also asynchronous and bounded. The production platform timeout remains unchanged. |
| The real browser test timed out inside Bun's promise matcher | Await Playwright execution before the matcher; preserve the success and duplicate/error/console/timeout assertions. |
| Request/test/dynamic-feature patterns were implicit | Added an application-owned scope recipe and seven integration cases covering concurrency, private dependencies, root sharing, cancellation on close, error retention, test substitutions, dynamic import/plugin validation/contributions, startup rollback and thenable work results. |
| The new recipe initially described an awaited thenable as its wrapper type | A compiler regression failed before changing its return contract to `Promise<Awaited<R>>`; both compiler lanes now accept the exact number-valued consumer. Core provider Promise identity is unchanged. |

The [design](../superpowers/specs/2026-09-09-enterprise-verification-design.md)
and [implementation plan](../superpowers/plans/2026-09-09-enterprise-verification.md)
record the scope. The [integration guide](../guides/enterprise-integration.md)
contains the application ownership contract and links the executable recipe.

## Verification

All commands ran serially where they invoke compiler-heavy gates.

| Gate | Observed result |
| --- | --- |
| Full `npm run check` | 1,004 tests, 0 failures, 5,807 assertions across 52 files in 607.61 seconds; classic build passed. |
| Final classic and native typechecks/builds | Passed after the recipe's type-only `Awaited<R>` correction. |
| Strict native source diagnostic audit | 124 files; 670 expected/670 matched diagnostics, 659 primary plus 11 supplemental, zero gaps, unexpected diagnostics or failures. |
| Final integration/platform suites | 36 tests, 0 failures, 257 assertions across five files. Includes all seven recipe cases and actual browser failure oracles. |
| Existing runnable examples | All nine passed: box-adapters, composition, contributions, modules, observers, plugins, scopes, tokens and wbs-scope. |
| Required portable matrix | Actual archive, Deno 2.9.6 and minified Chromium 153.0.8010.12 Worker all passed; esbuild 0.28.2 and Playwright 1.63.0 are lockfile-pinned. |
| Review and documentation | Independent code/type review findings addressed; workflow YAML parsed, new local/reference links checked, `git diff --check` clean. |

The full test run exercised the final runtime implementation. The last correction
changes only the recipe's erased TypeScript annotations; fresh classic/native
typechecks and the focused suites verify that correction. Failed exploratory
runs are not presented as acceptance. The full gate's earlier trial failed the
new inconsistent-version regression while its prior module code was cached;
the subsequent complete run above is the passing result.

The [retained portable evidence](../benchmarks/results/2026-09-09-fee5a42/README.md)
records the actual source hash, archive and bundle hashes, versions, lockfiles and
results. It is labelled as a dirty-worktree observation at the starting commit;
the implementation is committed separately. Tool hashes identify version-probe
entries, not transitive runtime attestation. Reproduce the installed tool tree
with its locked `npm ci` command.

## Original enterprise acceptance audit

| Requirements | Evidence retained and checked |
| --- | --- |
| B1/B2: independently packaged boxes | Actual box archives and declaration/runtime consumer tests in the full gate. The archived sas-box and val-box candidate hashes still match `23f1d407…77a91` and `a44566c0…37e0a`; both related source checkouts remain clean. |
| T1/T2: graph safety, inference and scale | Source and physical declaration negatives, strict native diagnostic inventory, supported 100/500-operation measurements and 1,000-provider grouped/module fixtures. Original failed long-fluent rows remain explicit compiler-limit evidence. |
| M1: modules/tokens | Installed private/exported-module, renaming, nominal token and declaration fixtures in both compiler/package lanes. |
| L1/L2/A1: lifetime, ownership, startup | Scope/lifetime/disposal/startup suites, package oracles and overlapping operation/startup-failure integration cases. |
| E1/E2: extensions, metadata, boxes | Class/function adapters, aliases, optional/lazy/all references, contributions, metadata/observer/box suites and archive consumers. |
| P1: plugin boundary | Descriptor/output validation and lifecycle tests, plus actual dynamic import, private plugin token, contribution use and exactly-once teardown. |
| Q1: runtime/package/comparison evidence | Node/Bun CJS/ESM and both declaration emitters, newly executed Deno/Chromium archive lanes, cited capability matrix and retained bounded compiler/performance reports. No third-party throughput ranking is claimed. |
| R1: documentation and handoff | README, migrations, guides, all runnable examples, existing three-package publishing instructions and exact archived candidate evidence. A future publication needs a candidate for its intended commit. |

## Remaining boundaries

- Long individual fluent chains still reach compiler limits. Use the supported
  bulk/group/module route for 1,000-provider applications; no original failed
  row has been relabelled as passing.
- Request disconnects, streaming completion and component destruction remain
  host-owned events. The recipe proves DI ownership, not an unimplemented
  transport or framework adapter.
- The package preserves exact Promise-valued services and explicit ownership.
  It does not copy Nest's transparent factory awaiting, Angular's ambient
  injection context or Inversify's mutable live registry.
- The prior `cb24cfa` candidate/`fee5a42` handoff remains evidence for those
  revisions. This branch-delivery task does not publish packages or create a
  source tag. The existing untracked execution handoff is preserved.

## Hosted CI follow-up

Implementation commit `709de4628480dd16f45a4490d9facabb3adff46e` was pushed
to the existing `origin/feat/v0.1` branch. The first
[hosted run](https://github.com/dany-fedorov/di-bag/actions/runs/34319167669)
passed the required archive/Deno/Chromium matrix but failed both jobs because of
test setup assumptions that were hidden by the local workspace:

- Two adversarial source fixtures imported ignored sibling source checkouts.
  They now import the public box packages, installed from the tracked archives
  as development dependencies. Production dependencies remain empty.
- The broken-archive fixture copied historical machine paths. It now uses the
  active configured tool identities and still requires the exact missing-build-
  input failure and nonzero exit result.
- Three real browser protocol mutations used a one-second budget including cold
  Chromium startup. They now use the existing six-second production lane budget.
  The explicit 100 ms timeout mutation and all protocol failure assertions remain.

Local follow-up verification passed both typecheckers, 128 adversarial/type tests
with 460 assertions, and all 29 platform tests with 226 assertions, including
actual Chromium protocol failures. An isolated clone with no sibling checkouts
or ignored platform packages passed a locked `npm ci`, foundation pinning, both
typechecks and 42 affected tests with 233 assertions. The initial offline install
attempt lacked the compiler tarball in its cache; the locked registry install
succeeded. Independent review found no actionable follow-up issues. Hosted
acceptance requires both jobs to pass; the
[branch workflow history](https://github.com/dany-fedorov/di-bag/actions/workflows/ci.yml?query=branch%3Afeat%2Fv0.1)
records each delivered revision independently of these local observations.
The pre-existing untracked execution handoff is preserved.

The [second hosted run](https://github.com/dany-fedorov/di-bag/actions/runs/34320037792)
at `0e5e70e` passed the entire portable job. Its retained matrix records a clean
checkout and all three passing lanes. The contract job passed 988 tests but its
release-verifier setup still referred to ignored sibling directories; that
before-hook failure prevented the archive-verifier cases from executing. The
same failure was reproduced in the isolated clone. That synthetic manifest
fixture now creates its own canonical box checkout directories beneath its
temporary directory and removes them with the existing fixture cleanup. Actual
archive bytes still come from the tracked packages, and production manifest and
archive validation remain unchanged.

After that correction, all 89 release-artifact tests passed in the isolated clone
with 412 assertions, including the real Node/Bun archive and declaration
consumers. Both classic and native source typechecks passed there as well. The
strict native audit accepted all 124 files with 670 expected/670 matched
diagnostics and zero unexpected diagnostics or failures.
