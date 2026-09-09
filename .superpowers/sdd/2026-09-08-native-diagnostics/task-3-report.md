# Task 3: physical replacement package proof

Date: 2026-09-08

Task 3 adds package-boundary evidence at the unchanged Task 2 no-adoption
signature. It does not recover native diagnostic parity. The installed native
checks retain the exact existing 27-gap inventory: `incremental` 4,
`inline-replacement-wrong-shape` 1, `module-hidden-private-needs` 1,
`module-narrowing` 1, `module-rename` 1, `provider-boundaries` 1,
`replacement-context` 12, `replacement-wrong-shape` 1, `required-this` 1, and
`union-replace` 4.

## RED

Adding the downstream-only reflection consumer to the existing classic physical
emission harness without its emitted import rewrite failed in both module modes.
`Program.getSourceFile(declarationPath)` was `undefined` for the `.d.cts` and
`.d.mts` cases. The run reported 10 passing tests, 2 failures and 40 assertions.
This demonstrated that source-level reflection success did not silently satisfy
the package test.

After routing all ten fixed negative fixtures, the first native run rejected the
stale package expectation for `negative/inline-replacement-wrong-shape.ts`: the
matcher observed its one existing declared native gap while the old assertion,
which previously knew only about `negative/incremental.ts`, expected zero. The
package assertion now uses a fixed per-fixture map totaling exactly 27; it does
not scan comments or permit unknown gaps.

## Routes and physical checks

- `replacement-reflection.ts` emits a real `.d.cts` and `.d.mts`; its copied
  consumer checks numeric output, non-`any` root/module `ReturnType` views and
  the exact forwarding parameter tuple.
- The native package matrix selects the actual classic emitter for
  `classic6` and the native emitter for `native7`, deletes the owned producer
  directory, then requires the downstream classic and native programs to load
  the declaration and not the producer.
- The classic token package harness writes each emitted declaration to disk,
  removes the physical producer source and checks the same loaded-file boundary.
- `boxContractFixtures` consumes the strict audit's ten-file inventory. Installed
  copies route `src/di-bag` to the public package root and module narrowing to a
  physical, unchanged `tests/types/modules/feature.ts` copy whose source import
  alone is routed to `di-bag`.
- Every installed negative requires diagnostics only in its copied consumer,
  its original marker regions to match and no TS2589.

## GREEN evidence

- Final `bun test tests/token-package.test.ts --timeout 120000`: 12 pass,
  0 fail, 60 assertions.
- Final `bun test tests/box-package.test.ts --timeout 120000`: 113 pass,
  0 fail, 313 assertions.
- Final `bun test tests/native-package.test.ts --timeout 120000 --verbose`:
  2 pass, 0 fail, 1,152 assertions; classic emission took 92.7 seconds and
  native emission 73.8 seconds.
- `bun test tests/package.test.ts --timeout 120000`: 77 pass, 0 fail,
  495 assertions.
- `npm run typecheck`: exit 0.
- `npm run typecheck:native`: exit 0.

Package proof is complete. Native diagnostic parity remains incomplete at 27
missing useful primary messages, so Step 4 and the overall capability stay open.
