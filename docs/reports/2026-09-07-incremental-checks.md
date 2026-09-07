# Incremental dependency-check integration

Builder additions and replacements now validate only dependency relationships
that cross the boundary between already-accepted history and the incoming
registrations. The incoming registration map still passes through the complete
`Checked<N>` contract first. This preserves admission and incoming-error
precedence while avoiding repeated validation of every relationship in fluent
builder history.

The change is limited to the five builder checks for `add`, `bind`, the two named
`replace` overloads and token `replace`. Module construction, installation,
forking, closure, runtime behavior, contextual inputs and inferred outputs remain
unchanged. `IncrementalChecked` is exported only from the internal `types.ts`
module; it is not added to the package root API.

## Compiler-work gates

Both gates compile real generated public API calls with the existing compiler
options and virtual-source host. TypeScript is pinned at 5.9.3, so a compiler
upgrade must explicitly review these work counters.

| Public program | Before | After | Ceiling | Reduction |
| --- | ---: | ---: | ---: | ---: |
| 100 chained named additions, valid | 3,749,643 | 838,875 | 1,500,000 | 77.6% |
| 100 token bindings, valid | 10,296,781 | 1,361,372 | 2,000,000 | 86.8% |

The pre-change programs both had zero diagnostics and visible JSON output; their
tests failed only because the instantiation counts exceeded the fixed ceilings.
After the change both programs still have zero diagnostics and pass those
ceilings. The workers retain all prior JSON fields and CLI arguments and now add
the compiler's `instantiations` counter.

These ceilings are regression gates, not general performance guarantees. They do
not claim portable latency or memory limits, and they do not remove the existing
larger advisory scale cases.

## Contract coverage

New source and packed-package fixtures cover both directions of named and token
relationships, forward additions, grouped additions, named and token replacement,
binding output admission, opaque provider graphs and bound-token contracts,
missing dependencies, private module constraints, exact richer replacement
outputs, explicit replacement generics, provider graph metadata and acquisition
frames. The fixtures compile against both CommonJS and ESM installed declarations.

One simultaneous-error control intentionally changes the selected useful
diagnostic: when an incoming group contains both an invalid local named edge and
a wrong token edge, the incoming `Checked<N>` result now reports the named shape
error before cross-boundary token validation. The pre-change semantic RED reported
the token-contract error instead. Existing supported method-return replacement
inference remains covered by its unchanged fixture.

## Verification

- Focused compiler-work gate: 2 tests passed, 0 failed.
- Focused incremental source contracts: 2 tests passed, 0 failed.
- Source plus installed CommonJS/ESM and token declaration contracts: 100 tests
  passed, 0 failed, with 838 assertions.
- Full `npm run check`: strict typecheck, 308 tests passed across 19 files with
  1,964 assertions, and the declaration build completed successfully.
- All four runnable examples completed successfully: WBS ownership, named
  modules, box adapters and token modules. `git diff --check` was clean.
