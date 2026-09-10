# API renaming implementation and verification

The complete [renaming plan](../api-renaming-plan.md) is implemented using the
[recorded decisions and assumptions](../superpowers/specs/2026-09-10-api-renaming-design.md).
The [migration guide](../migrations/api-renaming.md) maps every removed public
name and explains the consolidated options and ownership behavior.

## Scope and source identity

The branch started from main at `f5eb4d3` and retained the already merged native
provider metadata and runtime scaling work. The original dirty checkout was
preserved in a separate worktree workflow. No compatibility aliases or runtime
dependencies were added. Version `0.1.0` remains the local candidate version;
registry publication is separate work.

The verified source SHA-256 is
`8abf161347df79efba6ac638de0236ce2bcb680aeaa5d7f1a6524c09c0f6bd53`.
This hashes each sorted relative `src/**/*.ts` filename followed by its bytes,
using the compiler-control protocol. It identifies the implementation separately
from documentation and integration commits.

## Review and regressions

Independent source, migration, and final incremental reviews approved spec
compliance and code quality after corrections. Review found and fixed optional
static metadata being incorrectly required in inspection, inherited dynamic
options bypassing validation, and getters changing a validated metadata mode or
callback before execution. Both metadata modes now retain accurate optional
presence, and validated dynamic settings are snapshotted once.

Installed declaration tests found a private plugin function name leaking into
inferred exports. `PluginProviderFactory` now names the exact public callable
contract. Both compilers verify downstream consumers after the producer source
is physically removed. The implementation retains the original checked tuple,
validator, acquisition-mode and provider contracts.

Runtime and compiler fixtures cover the consolidated metadata and transformations,
explicit factory context, immutable configuration, register overloads, named and
token graphs, scopes, startup, retries, cleanup ownership, and application-error
identity. Library diagnostics now count failed callbacks, distinguish closing
from closed, retain complete cycle/dependency paths, and expose frozen structured
details. Invalid-tuple fixtures retain their selected dependencies; diagnostic
inventories retain useful primary errors alongside exact supplemental overload
messages.

## Documentation

Generated reference coverage verifies every public export and callable overload,
including callable type aliases and generic callable properties. Generation
produces 104 API pages and 210 syntactically valid TypeScript blocks. The docs
unit tests pass, and the built site validates 112 rendered pages and 13,877
internal links, anchors and assets. Current guides, examples, publishing guidance,
changelog and migration notes use the selected API; explicitly historical Before
examples retain their original spellings.

## Final local gates

All commands completed successfully with pinned Node 24.20.0, npm 11.19.0,
Bun 1.4.0, classic TypeScript 6.0.3 and native TypeScript 7.0.2. Subprocess gates
ran outside the restrictive shell sandbox; npm update notifications were disabled
to keep package stderr deterministic. No source or assertion was changed to
accommodate the sandbox's subprocess `EPERM` behavior.

| Gate | Result |
| --- | --- |
| `npm run check` | 904 tests passed, 0 failed; classic typecheck and build passed. |
| `npm run typecheck:native`, `npm run build:native` | Passed. |
| `npm run check:native` | 126 fixtures accepted; all 636 primary and 17 supplemental expectations matched, with zero gaps or unexpected diagnostics. |
| Node runtime scale after each compiler build | 2 tests passed for each build: deep cleanup and late acyclic/cyclic graph edges. |
| All 9 runnable examples | Passed; the scopes example was rerun after correcting its printed label. |
| `npm run docs:check`, `npm run docs:build` | 12 docs tests passed; generated reference and site validation passed. |
| `npm run check:platform` | Archive, installed Deno root, and minified Chromium Worker lanes passed. |

The full suite includes source, packed Node/Bun CommonJS/ESM execution,
classic/native emitted declarations, release-artifact verification, lifecycle and
ownership regressions, and named/token scale contracts. Deno 2.9.6, esbuild
0.28.2, Playwright 1.63.0 and Chromium 153.0.8010.12 were pinned for the platform gate.

## Compiler diagnostic measurements

All 18 supported controls were accepted: 100 chained named registrations,
1,000 grouped named registrations, and 100 typed-token bindings, each valid,
missing a dependency, or containing an incompatible service, under both
compilers. Every negative case retained the intended boundary diagnostic.
The source hash was unchanged before and after every execution.

| Compiler | Count / form | Case | Compiler ms | Process ms | Peak MiB | Instantiations |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 6.0.3 | 100 / chained | valid | 1470 | 1758 | 405 | 903692 |
| 6.0.3 | 100 / chained | missing | 1516 | 1805 | 402 | 899851 |
| 6.0.3 | 100 / chained | wrong-shape | 1478 | 1761 | 404 | 911935 |
| 6.0.3 | 1000 / grouped | valid | 3374 | 3688 | 653 | 2701039 |
| 6.0.3 | 1000 / grouped | missing | 3354 | 3664 | 652 | 2665877 |
| 6.0.3 | 1000 / grouped | wrong-shape | 3334 | 3645 | 703 | 2712813 |
| 6.0.3 | 100 / bindings | valid | 2194 | 2471 | 514 | 1668125 |
| 6.0.3 | 100 / bindings | missing-final-token | 2130 | 2414 | 494 | 1601059 |
| 6.0.3 | 100 / bindings | mismatched-invariant-service | 2134 | 2419 | 511 | 1663687 |
| 7.0.2 | 100 / chained | valid | 386 | 452 | 126.49 | 885104 |
| 7.0.2 | 100 / chained | missing | 385 | 453 | 126.45 | 881260 |
| 7.0.2 | 100 / chained | wrong-shape | 385 | 452 | 124.59 | 893773 |
| 7.0.2 | 1000 / grouped | valid | 1269 | 1349 | 228.0 | 2682371 |
| 7.0.2 | 1000 / grouped | missing | 1259 | 1346 | 258.29 | 2647206 |
| 7.0.2 | 1000 / grouped | wrong-shape | 1275 | 1358 | 256.54 | 2694571 |
| 7.0.2 | 100 / bindings | valid | 611 | 670 | 169.15 | 1642687 |
| 7.0.2 | 100 / bindings | missing-final-token | 602 | 668 | 168.77 | 1575607 |
| 7.0.2 | 100 / bindings | mismatched-invariant-service | 618 | 683 | 164.98 | 1638253 |

These are single fresh-process observations, without warmups or repeated samples;
no statistical speedup or regression claim is made. The continuously supported
controls were selected to measure the changed signatures and richer diagnostics.
Known 1,000-call fluent compiler/resource limits remain documented in the
[scale contract](../benchmarks/typescript.md#supported-scale-contract-2026-09-09).
The historical exhaustive matrix is unchanged. [Retained sanitized evidence](../benchmarks/results/2026-09-10-api-renaming/README.md)
contains all measurements, diagnostics and portable runtime results.

The associated pull request and main-branch history record the integration result
and remote CI checks; source-content identity above remains stable across those
integration and documentation commits.
