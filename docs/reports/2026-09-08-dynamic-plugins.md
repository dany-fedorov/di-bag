# Validated dynamic plugin boundary

The dynamic plugin boundary is implemented locally with physical package evidence.
`DiBag.fromPlugin` admits an application-selected unknown descriptor only after
protocol and result validation, while the adapter remains one ordinary provider
for dependency routing, modules, aliases, sharing, lifecycle observation and
cleanup.

The archive runtime assertions cover descriptor rejection before factory effects,
raw identity, output-phase errors, original-value cleanup after failed validation,
pending native validation/close, required/optional/lazy/all host references,
private module aliases with selected sharing, canonical observer attempt identity,
and portable-core raw use without a classifier. They execute in actual Node/Bun
CJS/ESM archives. Plugin producer, consumer and negative fixtures now route through
classic and native emitters; each physical source producer is deleted before both
compilers consume its emitted declaration.

`examples/plugins.ts` selects an `unknown` descriptor, validates a structural
`Handler`, binds the resulting provider into an exported typed module, checks its
output, and verifies the original plugin disposer runs once.

## RED/GREEN evidence

The initial archive-harness route was intentionally added before its fixture. The
managed sandbox then returned its known synthetic empty Node/Bun child output, so
the initial ordinary package run failed only while parsing empty stdout. The real
unrestricted archive run exposed two physical integration failures:

1. Unannotated `export const fromPlugin = DiBag.fromPlugin` could not emit because
   its function type was only reachable through `dist/plugins`.
2. The source-deleted consumer kept `import('./plugins')` type queries after the
   harness had rewritten only static imports. Native strict-marker matching also
   correctly rejected the stale broad `not assignable` marker for a missing mode.

GREEN exposes the plugin factory type identity from the package root, routes the
dynamic type queries to the emitted declaration, and records the compiler's
specific missing-acquisition marker. No plugin runtime implementation change was
needed.

## Pre-review verification

| Command | Result |
| --- | --- |
| `bun test tests/types.test.ts -t plugins` | 3 pass, 11 assertions, 3.17s |
| `bun test tests/package.test.ts --verbose` | 77 pass, 495 assertions, 58.58s |
| `bun test tests/native-package.test.ts --timeout 120000 --verbose` | 2 pass, 656 assertions, 118.86s; classic6/native7 emitters, CJS/MJS source-deletion consumers, Node/Bun runtime lanes |
| `npm run typecheck:native` | exit 0 |
| `npm run build:native` | exit 0 |
| `npm run check:native` | exit 0; native 7.0.2, 113 files, 647 expected regions, 620 matched, 27 existing declared diagnostic gaps, zero unexpected diagnostics/failures |
| `npm run check` | exit 0; 720 pass, 3,830 assertions, 596.23s, then classic declaration build |
| all nine `bun run examples/*.ts` commands, serially | exit 0; `examples/plugins.ts` prints `HELLO` |

Archive/package and compiler process commands ran outside the managed sandbox,
because its Bun child-process interception returns synthetic empty results. The
normal direct example runs remained in the sandbox.

## Final reviewed-source evidence

The final reviewed source was verified at
`57021fc1d96abbe75e025e7b29d52a5a086711d5` before this evidence-only update.
This is distinct from the pre-review runs above. Complete retained command logs
are local `/tmp` artifacts and record the final exits and emitted results:

| Command | Result | Retained log |
| --- | --- | --- |
| `bun test tests/package.test.ts --verbose` | exit 0; 77 pass, 495 assertions, 57.48s | `/tmp/di-bag-plugins-final-package.log` |
| `bun test tests/native-package.test.ts --timeout 120000 --verbose` | exit 0; 2 pass, 656 assertions, 118.51s | `/tmp/di-bag-plugins-final-native-package.log` |
| `npm run check` | exit 0; 720 pass, 3,830 assertions, 38 files, 563.57s | `/tmp/di-bag-plugins-final-check.log` |
| `npm run typecheck:native` | exit 0 | `/tmp/di-bag-plugins-final-typecheck-native.log` |
| `npm run build:native` | exit 0 | `/tmp/di-bag-plugins-final-build-native.log` |
| `npm run check:native` | exit 0; 113 files, 647 expected regions, 620 matched, 27 declared gaps, zero unexpected diagnostics/failures | `/tmp/di-bag-plugins-final-check-native.log` |
| nine examples, serially | exit 0 for each | `/tmp/di-bag-plugins-final-example-box-adapters.log`, `/tmp/di-bag-plugins-final-example-composition.log`, `/tmp/di-bag-plugins-final-example-contributions.log`, `/tmp/di-bag-plugins-final-example-modules.log`, `/tmp/di-bag-plugins-final-example-observers.log`, `/tmp/di-bag-plugins-final-example-plugins.log`, `/tmp/di-bag-plugins-final-example-scopes.log`, `/tmp/di-bag-plugins-final-example-tokens.log`, `/tmp/di-bag-plugins-final-example-wbs-scope.log` |
| `git diff --check` | exit 0 | `/tmp/di-bag-plugins-final-diff-check.log` |

The package/archive and compiler commands were run outside the managed sandbox
because their child-process behavior requires it. The final review found no
Critical, Important, or production issue; it accepted the example-identity
Minor. This retained-log update closes the evidence-traceability Minor.

## Files changed

- `src/index.ts`
- `tests/plugins-runtime-fixture.ts`
- `tests/package.test.ts`
- `tests/native-package.test.ts`
- `tests/box-contract-fixtures.ts`
- `tests/types/negative/plugins.ts`
- `examples/plugins.ts`
- `README.md`
- `CHANGELOG.md`
- `docs/migrations/0.1-to-enterprise.md`
- `docs/superpowers/plans/2026-09-08-dynamic-plugins.md`
- this report

## Self-review and limitations

The runtime fixture uses `DiBagPluginError.phase`, checks each disposer receives
the exact original value, and exercises canonical rather than synthetic lifecycle
attempts. The fix-round gates independently hold native source settlement,
failed-validation disposal, and external observer work, proving `close()` waits
for required cleanup but not application-owned observer work. The only Task 1
source adjustment is the root type export of `fromPlugin`; the physical declaration
RED proves why that public type identity is needed. The native source audit accepts
27 existing, explicitly declared diagnostic-message gaps; plugin regions have no
gaps. Review and final source verification are complete locally; push and remote
SHA verification remain conditional and were not attempted.
