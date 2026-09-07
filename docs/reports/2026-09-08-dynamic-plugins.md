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

## Verified commands

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
attempts. The only Task 1 source adjustment is the root type export of
`fromPlugin`; the physical declaration RED proves why that public type identity is
needed. The native source audit accepts 27 existing, explicitly declared
diagnostic-message gaps; plugin regions have no gaps. Independent Task 1/Task 2
spec/quality and whole-increment review remain controller-owned work and are not
claimed by this implementation report.
