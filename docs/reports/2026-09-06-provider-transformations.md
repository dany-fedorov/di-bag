# Provider transformations: implementation evidence

The provider/adapter increment is in progress. This report does not mark E2 or
the enterprise program complete. Governing plan:
`docs/superpowers/plans/2026-09-06-provider-transformations.md`.

## Task 1: immutable metadata and checked inspection

Commit `06918c8` adds nominal immutable `Provider<F,M,A>` handles,
`DiBag.withMetadata` and non-resolving `bag.inspect`. A single private registry
authenticates original owned handles and new providers. Metadata preflights all
own keys before getters, freezes copied records, and retains unfrozen payloads.

Provider invariance survives declaration emission. Opaque erased registrations
cannot prove closure, including through `NoInfer`. The fourth module carrier D
retains static metadata and ordered acquisition-frame contracts through export,
rename and install; existing C independently retains private consumer needs.
Plain providers preserve existing defaults and exact sync/Promise output types.

TDD evidence includes missing APIs before implementation, union-shaped metadata
erasure and erased-registration replacement rejection before their fixes. Existing
inline factory inference required a contextual view of the invariant provider's
factory contract and separate replacement overloads; no preliminary-any inference
experiment was adopted. Source and emitted fixtures cover the resulting boundary.

Independent exact-commit verification:

- `npm run check`: strict typecheck and final build passed; 181 tests, 813
  assertions, zero failures across 11 files (283.64 seconds).
- The full suite includes actual Node CJS/ESM consumers and emitted positive/
  negative provider contracts, plus all retained runtime/lifecycle/type tests.
- Current registration-scale gates passed. Actual 1000-provider nominal-module
  valid/missing/wrong-shape cases took 44.071/44.812/47.097 seconds. These are
  compiler observations, not editor-latency or universal scalability claims.
- Both `examples/wbs-scope.ts` and `examples/modules.ts` ran successfully;
  `git diff --check` passed.

Independent task review: spec compliant, quality approved, no findings. The
review's unchanged-code verification item was resolved by checking that the
runtime/acquisition diff adds inspection only, plus the covering tests above.
Mapping and multiple ownership stages are covered below; actual box adapters
remain a subsequent task.

## Task 2: explicit mappings and staged ownership

Commit `6a71ab4` adds `DiBag.mapSync`, `DiBag.mapAsync` and additive ownership
for authenticated providers. Sync mapping preserves exact raw values and
Promise identity; async mapping explicitly awaits. Provider output, declared
needs and metadata/frame contracts remain checked through composition.

Attempt-local evaluation retains stable ownership stages and original disposer
arguments. Exposed projection success is independent of a source Promise the
projection did not await. Retired attempts retain pending work and finalization;
retries do not reuse their identities. Source pending permission is independent
of outer projection state. Cleanup reports every original cause in invocation
order even when separate finalizers reject in a different order.

TDD recorded both missing helper failures and a separate metadata-provider
ownership failure before implementation. Final receiver hardening recorded both
source and emitted acceptance of invalid callbacks before fixing the signatures.
The implementation report distinguishes its full run from the later two-
signature change and covering runs; the independent run below is on the final
commit, including that hardening.

Independent exact-commit verification:

- `npm run check`: strict typecheck and build passed; 204 tests, 956 assertions,
  zero failures across 12 files (291.61 seconds).
- All source/emitted positive and negative contracts, real Node CJS/ESM
  consumers, runtime/disposal/projection/inspection regressions and current
  scale gates passed. The 1000-provider nominal-module valid/missing/wrong-
  shape observations were 45.008/46.812/46.307 seconds.
- Both existing examples and `git diff --check` passed.

Independent task review: spec compliant, quality approved, no findings. Its
unchanged-inspection verification item was resolved through the existing frozen
snapshot implementation and covering inspection tests. Task2 is complete; the
provider plan still requires real box adapters and final broad review.

## Design decisions and costs

- Ordered acquisition frames use presence records: repeated adapters do not
  overwrite one another, and a pending inner stage does not pretend its metadata
  exists. Cost: tuple/presence handling in inspection types.
- Module D retains exported provider contracts separately from output P and
  private requirements C. Cost: annotation and TypeScript instantiation overhead;
  plain empty-metadata defaults remain usable.
- Supplied val-box options require an explicit value-mode discriminator, while
  no options remains shorthand for required value. Cost: a more verbose options
  object; structurally hidden modes cannot promise the wrong result type.
- Sas-box sync-first requires a complete, required sync-capability field. A
  no-cast compiler probe accepted hiding a number-returning sync method behind
  a string-returning async-only view, including an optional-never sync view;
  runtime sync-first would then return a number. Requiring the capability field
  rejected both narrowed views and retained exact dual/unknown/async outputs.
  Cost: async-only structural views use explicit async mode or supply
  `sync: undefined`; real box classes already satisfy the complete protocol.
- A retired attempt waits for its pending source/projection work before
  finalizing accepted stages: an in-flight projector may still use them after
  an outer projection fails. Cost: nonsettling work can retain those resources
  and keep eventual close pending; the original failure still returns promptly.
- Both disposal overloads reject explicit required receivers, matching their
  receiver-free invocation. Cost: callers must bind a receiver-dependent
  finalizer or wrap it in an arrow; factory inference/create identity remain.
- Keep verified box tarballs as versioned test-only fixtures, with revision and
  checksum provenance, excluded from the di-bag package. Cost: maintaining small
  pinned test archives when box compatibility changes; fresh-checkout integration
  does not depend on local temporary paths or unpublished registry versions.

The bounded capability probe is `/tmp/di-bag-sas-capability-probe.cjs`:
`node /tmp/di-bag-sas-capability-probe.cjs` produced only the two intended TS2345
diagnostics and demonstrated the hidden runtime result `number 42`. This is
design evidence, not verification of an implemented adapter. The adapter task
requires source and emitted regressions plus real packed consumers.

A separate controller type probe found both disposal overloads accepted
`function(this: {cleanup(): void}, value: number) { this.cleanup(); }` despite
receiver-free runtime invocation. The strict actual-source probe produced zero
diagnostics before hardening. Task2 now requires negative source/emitted cases
and explicit receiver-free disposer signatures; its final report records the
test evidence rather than treating this probe as a completed fix.

These decisions guide remaining implementation; they are not claims that the
adapters already exist. Publication, pushing and branch cleanup have not occurred.
