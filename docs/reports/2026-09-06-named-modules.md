# Named modules: implementation evidence

Named open-module composition is implemented and reviewed. This completes the
named portion of M1; typed tokens and the other enterprise acceptance rows
remain required program work.

## Delivered

- Immutable `DiBag.module()` builders support checked additions, replacement,
  forward requirements and exact export tuples, including empty exports.
- Nominal sealed modules retain provided services, external requirements of
  all providers, and private-consumer constraints. Unexported or currently
  unreachable providers do not disappear from validation.
- Installation exposes exactly the selected exports and allocates fresh private
  binding identities. Repeated renamed installations isolate acquisitions and
  disposal ownership.
- Renaming preserves original factory parameter names and private identity.
  Exported and external references keep their provenance, even when a temporary
  rename gives them the same public name.
- Host replacement and fresh-root forks remain visible to internal consumers
  of exports. Retained consumer contracts remain checked through module, builder
  and bag annotations, including emitted declarations.
- The runtime returns the original service Promise, tracks actual binding
  dependencies, and disposes private owned resources after their dependents.

See [the module example](../../examples/modules.ts) and [README](../../README.md).
`ModuleProvides<M>` and `ModuleRequires<M>` expose readonly public contract
views; `ModuleRequires` contains external needs, not existing exports.

## Commits, review and verification

| Task | Commit | Result |
| --- | --- | --- |
| Binding identities and public slots | `4f6aab4` | Spec compliant, quality approved; no findings |
| Named modules and retained contracts | `9b9fb98` | Spec compliant, quality approved; no findings |

The final broad review covered actual branch range `94d9e52..9b9fb98`, including
preceding type hardening, WBS integration and packaging. It approved this
implementation gate with no new correction required. It did not claim the
known limitations below fixed or the enterprise program complete.

Independent verification against committed `9b9fb98`:

```sh
npm run check
npm run example:wbs
bun run examples/modules.ts
```

All commands passed: **144 tests, 0 failures, 527 assertions**, strict
typecheck, declaration build, real Node CJS/ESM consumers and both examples.
The complete test run took 268.46 seconds on the shared development machine.

Test-first evidence includes missing module APIs before implementation,
emitted-declaration contract erasure, and a real 1000-provider module graph
initially reaching TS2589. Scale tests do not use casts or broad output
assertions to erase graph checking.

## Compiler findings and corrections

The inferred `DiBag` facade initially exceeded declaration serialization limits
(TS7056). Explicit named function references fix emission without widening it.

TypeScript omits ordinary private field types in class declarations. Unexported
unique-symbol function witnesses retain invariant generic contracts in emitted
declarations; a separate private member preserves nominal provenance against
spread copies.

The scale fixture declares 20 modules of 50 providers, installs them and checks
exact first/middle/last consumer values. Its initial failure was the
5,000,000-instantiation limit at depth 12, not excessive recursive depth.
Per-key checking of each independent consumer requirement avoids repeatedly
rebuilding a large `Pick` of the complete public service map.

The valid graph and intended missing/wrong-shape rejections now pass. The
independent run observed approximately **45.5s valid, 42.3s missing, 43.2s
wrong-shape**. These are acceptance observations, not claims of good editor
latency or controlled speed superiority. Existing registration-group and
individual 100-operation gates remain passing.

## Remaining program obligations

- The measured 500/1000 individual-chain limits and large-graph editor latency
  remain open. See [compiler measurements](../benchmarks/typescript.md).
- A pre-existing inference combination rejects an inline selected
  method-returning override when another selected async override requires its
  newly added method. Independent strict probes confirm this on the exact
  pre-module baseline and current source. Predeclaring the unchanged override
  object works without casts and preserves its Promise type; source and emitted
  declaration fixtures cover the workaround. Full inline support remains open.
- Binding-keyed edges still misidentify a retry as the old failed dependency
  when its consumer caught that failure and became cached. The acquisition
  foundation plan explicitly fixes this with per-attempt identities.
- Typed tokens, provider transformations, box adapters, lifetimes, startup,
  extensions, diagnostics/plugins, platform evidence and release handoff remain.

## Decisions and costs

Private-consumer constraints remain invariant through all carriers. Consequently
`Module<P, R>` and ordinary `Bag<R>` annotations cannot discard a nonempty
retained constraint parameter. Prefer `typeof` or `ReturnType` when naming an
inferred installed composition. The cost is additional annotation detail and
compiler work; this decision was recorded in the type-foundation report before
module implementation.

The internal Bag constructor now accepts a binding graph. The unchanged negative
constructor expression therefore receives a second compiler diagnostic. Package
tests require exactly one original TS1362 type-only-export rejection and require
every diagnostic to originate in the consumer, instead of requiring one total
diagnostic. The cost is tolerating additional consumer-only errors in that
negative fixture; positive declaration consumers still check that the public
API compiles. No unchecked value constructor was introduced.

Feature branches and ignored review evidence are retained while the complete
program continues. No publication, remote push or credential storage occurred.
