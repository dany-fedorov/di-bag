# Lifetime policies: partial internal integration

Date: 2026-09-07. This checkpoint implements internal declarations and static
captive validation only. `withLifetime` is internal (`src/lifetime.ts`), is not
on the public facade, and is not a root runtime export. Root/scoped/transient
acquisition routing and the public lifetime API are not yet shipped.

The authenticated provider description now carries a frozen lifetime record.
Descriptions default to scoped; a replacement wrapper snapshots root capture
options once and preserves the source, owned stages, metadata, frames, tokens,
and acquired-value contract. Metadata copies the complete description. Token
rebinding changes only its binding field.

Graph completion and selected independent forks check strict roots. One lexical
traversal follows named/token edges through transients, stops at another root,
and rejects a scoped dependency with root/dependency identities. Public and
private visited sites are separate. Policy-bearing module exports retain their
local graph and renamed export mapping; private roots remain constraints even
in exportless modules. Replacing an exported root replaces its public lifetime
obligation. Default modules retain compatibility with existing annotations.

Capture permission requires a statically present literal true. Boolean values,
optional fields, and options that might be undefined remain strict. Separate
required-option overloads prevent explicit capture type arguments from granting
permission when the runtime options argument is omitted. Union validation
checks every option/registration branch, including through `NoInfer`.

## Compiler evidence and representation cost

The unannotated producer exports providers, builders, modules, bags, scopes,
named/token forks, raw/native acquisitions, and frames. Its unchanged consumer
asserts exact values and non-any inference. Both compilers also check copies of
that consumer against emitted declarations with producer sources absent. This
is early declaration integration evidence, not the later installed-package
lifetime acceptance claim.

| Final bounded check | Classic API 6.0.3¹ | Native 7.0.2 |
| --- | ---: | ---: |
| Producer declaration bytes | 42,000 | 42,000 |
| All emitted declaration bytes | 106,505 | 106,505 |
| Producer emission time | 1,311 ms | 129 ms |
| Emitted consumer check time | 445 ms | 247 ms |
| Producer/consumer diagnostics | 0 / 0 | 0 / 0 |

¹ The installed classic wrapper is `@typescript/typescript6` 6.0.2, whose
compiler API reports the pinned underlying 6.0.3 implementation. Timings are
single observations during other checks, not comparative benchmarks.

Actual emitter failures determined two new root type-only exports: `Builder`
(TS4023/4094/7056 on an inferred builder) and `ModulePublicProviders` (native
installed-producer TS2883). A named internal `ReboundProviders` mapped alias
removed TS4118 on inferred symbol-selected forks. No producer annotation or
diagnostic allowance was added to address these failures.

## Verification

- Focused declaration/source/emitted-consumer tests: 7 passing, 54 assertions.
- Final full type suite plus lifetime declaration tests: 87 passing tests,
  382 assertions after the diagnostic-precedence correction.
- Lifetime negative fixture: 47 exact diagnostic markers on both compilers;
  no supplemental lifetime diagnostics or lifetime allowances.
- Final classic/native typechecks and classic build: exit 0.
- Final native source gate: 89 files, 407 expected diagnostics, 380 matched,
  27 previously recorded unrelated native diagnostic gaps, zero failures or
  unexpected diagnostics. All 47 lifetime markers match directly.
- A stable `npm run check` passed all 464 tests (2,383 assertions), followed
  by a successful build. An earlier overlapping integration run exposed two
  installed-producer TS2883 errors, fixed by the specific type-only export.
- After that full pass, a narrow type-only guard correction preserved shape
  and missing-dependency diagnostic precedence for chained calls and local
  module graphs. Final coverage reran the entire type suite plus declaration
  tests, both typechecks, the native source audit and both emitted consumers.
  Runtime/scale implementation did not change after the full pass.
- All existing named, token, incremental, and benchmark scale checks passed in
  the full run, including 1,000-provider named modules; no compiler timeout or
  excessive-instantiation diagnostic was accepted as a useful rejection.

Runtime lifetime acquisition, cross-owner disposal/cycle rules, public helper
publication, and physical installed lifetime-package evidence remain later
checkpoints.

## Review and independent checks

Task 1 committed as `9b869a3`. Its task review approved both specification
compliance and quality with no findings. Independent committed-code verification
passed seven focused declaration/type tests (54 assertions), including the
virtual-source-erased consumer. A separate repeat of both actual emitters and
copied source-absent consumers produced zero diagnostics and the declaration
sizes above. These are early declaration checks, not installed lifetime runtime
coverage; the existing package routes continue to pass.

## Decisions and costs

1. Implement policies before scope options. This avoids ambiguous root context;
   sharing and child overrides require a later integration pass.
2. Validate captivity at end/fork. This limits repeated graph traversal but
   reports lifetime errors at graph completion.
3. Each root establishes its own capture boundary. Strict A can consume an
   explicitly capturing root B; separate strict roots still validate independently.
4. Retain lifetime topology only where current captive checks need it. Default
   modules stay lightweight; partial sharing must revisit this elision rule.
5. Outer lifetime wrappers replace policy, not ownership stages. Wrapper order
   matters for caching, while disposer/value pairings remain unchanged.
6. Require known lifetime literals and snapshot supported own options. Dynamic
   choices require branching; inherited option declarations reject.
7. Keep the helper internal until routing works. This costs an intermediate
   internal-only checkpoint without a public lifetime API.
8. Preserve the approved checkout and evidence workspaces. There is no extra
   worktree isolation; one writer and explicit staging protect user state.
9. Guard active transient construction, not ready historical ancestry. Later
   lazy unrolling is supported; actual ID cycles and capture rules still apply.
10. Export `Builder` type-only after concrete emitter failures. Its name becomes
    a public type compatibility commitment, without exposing its constructor.
11. Export `ModulePublicProviders` type-only after installed producer TS2883.
    This preserves inference at the cost of another maintained public type name.
