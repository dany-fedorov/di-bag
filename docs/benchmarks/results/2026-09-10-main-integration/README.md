# Integration with published native-provider main — Task 7

The reviewed performance branch at `3a93cda8b6ad269b07162b377a0d17ab3c3f72ea`
was merged with exact main `f5eb4d363e2769c6553d470fff13d3f1ee19f425`.
This is fresh integration verification, separate from the historical Task 6
performance measurements and its 1,043-test / 141-runtime / 24-compiler evidence.
No historical evidence or source identity was rewritten.

## Merge decisions and exact manual repairs

- One Git conflict: `tests/box-contract-fixtures.ts` was modified by the performance
  branch and deleted by native-provider main. Kept its deletion and ported its
  internal `src/types` import routing into `tests/provider-contract-fixtures.ts`.
  The physical-package incremental characterization consequently resolves the
  installed internal declaration rather than the unexported `di-bag/types` path.
  The one-off failing and passing routing probes are retained in the red/green logs;
  the original addition is retained in `fixture-migration.patch`.
- The first emitted Node verification failed because the performance branch's
  retention tests still imported removed `dist/val-box.js`. Migrated both controls
  to native acquisition metadata. The mapped-payload control still checks collection
  of all borrowed arrays while independent frame identity and inspection survive.
  The closing control still checks frame retention before close, collection after
  close, and a retained dependency proxy rejecting reads after close. All existing
  GC, owned-value identity and cleanup-order assertions remain.
- Production source required no manual repair: native metadata APIs and performance
  acquisition/storage/startup/compiler changes merged automatically. Both Facades
  retain native annotations; direct source specialization remains limited to
  operation-free sources. Metadata operations therefore keep their full pipeline.
- Retained main's `300_000` ms aggregate per-emitter package-test deadline. Historical
  Task 6 used 120 seconds; it is not relabeled as this deadline. The reviewed
  downstream declaration batching still covers all 16 remaining feature pairs,
  both emitters, both formats, both compilers and deleted-producer assertions.
  No compiler worker limits, admission rules, or scale generators changed.
- Regenerated API documentation with its generator. The merged generated output
  was already current; no generated file needed a manual edit.

## Dependencies and fixture inventories

`package.json` and `package-lock.json` exactly match incoming main. The removed
box adapters, exports, package dependencies and archived fixtures remain removed.
`npm ci --offline --ignore-scripts --no-audit --no-fund --cache /tmp/di-bag-npm-cache`
succeeded and installed the incoming lock without modifying it. Node is 24.20.0,
Bun is 1.4.2, classic TypeScript is 6.0.3 (through the locked wrapper), native
TypeScript is 7.0.2. CI retains its independently pinned Bun 1.4.0.

The provider package inventory contains 54 fixtures. Source inventory remains 124
files: positive/negative box-adapter fixtures are replaced by positive/negative
acquisition-metadata fixtures. Incoming marker changes also affect negative
acquisition-mode, modern-inline and provider-unions fixtures. Exact file and marker
changes are recorded in `fixture-changes.json`; package and replacement inventories
are in `fixture-inventory.json`. The strict replacement inventory remains exactly
106 primary plus one supplemental marker across ten fixtures. Its marker removal
and weakened-diagnostic rejection oracles pass unchanged. The full native source
audit now matches 639/639 markers (627 primary, 12 supplemental), with no known
rejections, unexpected diagnostics or failing files. Historical 674 is not the
current inventory.

## Verification

`commands.jsonl` records exact argument arrays, statuses and durations; each named
command has its complete separate log. All heavy commands ran serially under
`/tmp/di-bag-compiler-heavy.lock`, without competing controller measurements.

- Focused runtime: 303 tests across 23 files pass, including native metadata,
  acquisition modes, ownership, startup, persistent graph/module storage, scopes,
  private references, contributions, aliases, observers and adversarial integration.
- Both source typechecks and builds pass.
- Emitted Node suites: 31 tests pass on each emitter, including GC controls.
  `node-classic.log` retains the first obsolete-adapter failure; the resolved
  classic and native runs are recorded separately.
- Classic source contracts: 115 tests pass.
- Native source audit: all 124 files and 639 markers pass.
- Supervisor and release artifacts: 108 tests, 481 assertions pass in 18.76 seconds,
  including the complete physical archive Node/Bun/declaration verifier.
- Strict native replacement audit: five tests pass, including inventory oracles.
- Documentation generation and check pass: 102 API pages, 197 checked TypeScript
  blocks; docs check also passes its 11 Node tests and authored-site validation.
- Physical native package check: both emitter tests pass (1,206 assertions,
  95.70 seconds overall; classic 54.75 seconds, native 40.73 seconds). The initial sandbox invocation failed before test
  execution when subprocess Node/npm path discovery returned an unusable path;
  `package-contracts.log` preserves that failure. The unchanged check was rerun
  through scoped host execution without changing worker limits.

The controller supplied `current-main-ci-failure.log` from hosted run
34439243491 on current main. It is **not evidence from this integrated source**.
Its archive-verifier failure rejected an otherwise successful classic declaration
consumer because of `terminationReason: monitor`, matching the already reviewed
supervisor exit-race repair on this branch. Focused supervisor and release checks
were therefore added without changing production code.

## Source identity and self-review

`source-manifest.json` records every one of the 35 production source hashes,
parent identities, dependency hashes and the explicit fingerprint encoding.
The resulting source fingerprint is
`e82828202eab3b9d791604c85abaa3f14d8f538f551dd09e42efa7477559ac5b`.
Relative to historical integrated runtime source, five files change (`di-bag.ts`,
`index.ts`, `inspection.ts`, `provider-execution.ts`, `provider.ts`) and the two
adapter files disappear. Performance implementation in other production files
remains byte-identical to its reviewed source.

Self-review checked both parent-relative diffs, migration of incremental and token
extraction characterizations, current package batching and deadline, the lack of
removed adapter imports in executable tests/source, generated-doc freshness,
unchanged compiler bounds/generators, ownership/frame pipeline interaction, and
both staged/unstaged whitespace checks. No unrelated concurrent changes appeared.
Only this isolated checkout was edited; nothing was published or rewritten.

Full hosted gates, independent scoped review, publication and merge proof belong
to the controller. Existing documented compiler 1,000-operation and runtime-depth
limitations remain; this integration does not claim new performance measurements.
