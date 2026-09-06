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

After that gate, an additional controller probe exposed a missing retained-
failure case: a parent catches an outer projection failure, but the still-
pending raw source later reads the completed parent and gets a false cycle
through the parent's failed dependency edge. The strict no-cast probe compiles;
runtime exits1 with `cycle: parent -> failed -> parent` and no raw cleanup.
Task3 Step0 corrected this case, with its independent verification below. The
discovery does not erase the earlier test/review evidence or its limits.

## Task 3: optional box adapters and retained-failure correction

Commit `ae36def` implements structural `di-bag/sas-box` and `di-bag/val-box`
subpaths, without runtime/peer box dependencies or root adapter imports. Exact
mode/capability contracts, zero-argument/receiver checks, copied presence snapshots
and ordered acquisition frames retain source needs, metadata and ownership.
Frame slots are present as absent records before the source factory starts.
Raw box finalizers receive boxes; owning an exposed payload remains explicit.

The retirement correction abandons incoming failed dependency edges but retains
pending work, outgoing dependencies and finalizers. The original no-cast probe
now independently exits0: parent and late source both resolve to `{name:'parent'}`,
and the raw source is disposed. Projection and actual unboxing regressions cover
the case, alongside retained genuine-cycle and retry-identity tests.

Independent exact-commit verification:

- `npm run check`: strict typecheck, final build, 230 tests / 1,174 assertions,
  zero failures across 14 files (290.61 seconds).
- All actual CJS/ESM core and adapter consumers, source/emitted positive and
  negative contracts, runtime/lifecycle and current scale gates passed. Nominal
  1000-module valid/missing/wrong-shape observations: 45.018/44.538/44.809 seconds.
- All three examples and `git diff --check` passed.
- Committed test-only fixture hashes exactly match the independently verified
  sas-box and val-box archives; their source checkouts remain clean. Installed
  consumers test real constructors, shared cross-loader descriptors and core-only
  operation. Packed di-bag excludes fixture archives and box implementations.

Independent task review: spec compliant, quality approved, no findings. Binary
provenance and unchanged-core verification items were resolved with matching
archives and the full covering checks above. All three provider-plan tasks are
complete; broad whole-branch review remains pending.

### Inference carry-forward

The following context-sensitive form is a required compiler follow-up, not a
supported inline-inference claim at this checkpoint:

```ts
const raw = {
  snapshot(this: { snapshot: unknown }) {
    return {
      value: { present: true as const, value: Promise.resolve(42) },
      metadata: { present: true as const, value: { owner: 'db' } },
      alias: null,
    };
  },
};
const nested = fromValBox(() => ({ snapshot() {
  return { value: { present: true as const, value: raw },
    metadata: { present: false as const }, alias: '' };
} }));
```

The validation intersection infers broad `Registration`/unknown and rejects the
inline source with `invalid val-box snapshot capability`. A factory-specific
bound, explicit contextual factory intersection, and separate options/rest
validation did not correct this. The tested workaround is to predeclare that
identical factory body and pass its name to `fromValBox`; no annotation or cast
is needed, and exact payload/ordered-frame equality assertions pass. Failed
experimental overloads are not retained. The original inline case joins the
existing richer async fork case in required T2 work.

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
- Carry the retained-failure edge correction into adapter Task3: unboxing uses
  the same retirement path. Cost: additional prerequisite edge bookkeeping and
  review in that task; pending ownership cannot be removed merely to hide a cycle.
- Complete adapter Task3 with a predeclared nested snapshot factory while
  retaining its inline form as required T2 inference work. Three bounded
  signature hypotheses did not fix context-sensitive inference; the identical
  named factory needs no annotation/cast and preserves payload/frame contracts.
  Cost: an extra declaration for affected inline forms until dedicated inference
  correction; this is not completion of the enterprise inference requirement.

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

These decisions guide the verified task implementations and remaining program
work. The user separately authorized intermediate commits and pushes. The two
verified box feature branches have been pushed (see their foundation report);
di-bag's reviewed adapter checkpoint is ready for its coordinated push. No
publication, main integration or branch cleanup has occurred.
