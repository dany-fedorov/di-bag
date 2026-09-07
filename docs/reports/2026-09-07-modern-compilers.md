# Modern compiler adoption and inline inference

The development toolchain now uses the classic TypeScript 6.0.3 API through the
`@typescript/typescript6` 6.0.2 wrapper. This compiler change, with no production
library signature or runtime change, makes both previously bounded inline forms
supported: a nested method-returning val-box factory and a selected async fork
that consumes a richer service from another selected inline override.

## Toolchain and configuration

The `typescript` development alias is exactly
`npm:@typescript/typescript6@6.0.2`. Its transitive `@typescript/old` dependency
is overridden to exactly `npm:typescript@6.0.3`; `@typescript/old` is not a direct
dependency. The installed wrapper reports package version 6.0.2, while importing
`typescript` reports API version 6.0.3. The development commands use the
wrapper's unambiguous `tsc6` binary.

Strict source checking now uses NodeNext module and resolution modes with the
repository root as `rootDir`. The package build still overrides `rootDir` to
`src` and emits the existing CommonJS `.js` and `.d.ts` distribution. No runtime
dependency, compiler peer, box dependency, global install, deprecation ignore,
or stable-ordering flag was added.

## Regression proof

Before the dependency change, the exact source fixture failed under TypeScript
5.9.3 with TS2345 for the inline nested val-box capability and TS2322 for the
inline richer fork override. Exact assertions also failed with TS2344. The same
fixture failed through both actual installed CommonJS and ESM package routes.
The identical predeclared val-box and fork forms remained controls in the
fixture.

Four proof layers now use the TypeScript 6.0.3 API:

1. The source consumer imports the unchanged producer exports and proves exact
   output, needs, metadata, factory, frame and Promise contracts with zero
   diagnostics.
2. Actual installed package consumers compile the positive and matched negative
   fixtures in CommonJS and ESM modes. Invalid fork dependency shape and invalid
   val-box snapshot capabilities remain rejected.
3. The installed producer emits in memory as `modern-feature.d.cts` and
   `modern-feature.d.mts`, with zero pre-emit or emit diagnostics.
4. A separate downstream program receives only that declaration—the producer
   source is absent—and compiles the unchanged exact consumer assertions with
   zero diagnostics.

The installed real val-box fixture also proves nested inline adaptation through
the archived `val-box` package: the first output is the exact box, the second is
`Promise<number>`, and acquisition metadata is exactly the two ordered val-box
frames.

## Compiler-work gates

Fresh single-worker measurements on Node v24.20.0 and TypeScript 6.0.3 retained
the existing graphs and ceilings:

| Gate | Diagnostics | Instantiations | Ceiling |
| --- | ---: | ---: | ---: |
| 100 chained named additions | 0 | 839,103 | 1,500,000 |
| 100 token bindings | 0 | 1,361,600 | 2,000,000 |

These are bounded regression gates, not universal compiler-performance claims.
The TypeScript 5.9 scale tables and limitations remain historical records; this
adoption does not claim to improve them on 5.9.

## Scope still open

This increment does not install or validate the native TypeScript 7 compiler,
complete the large-scale 500/1,000 individual-chain work, or close the broader
enterprise compiler obligations. Those remain separate work. It also makes no
change to ownership, disposal, borrowing, sharing, factory awaiting, or public
library APIs.
