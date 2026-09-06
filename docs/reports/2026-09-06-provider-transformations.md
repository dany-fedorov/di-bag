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
Mapping, multiple ownership stages and actual box adapters are subsequent tasks.

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

These decisions guide remaining implementation; they are not claims that the
adapters already exist. Publication, pushing and branch cleanup have not occurred.
