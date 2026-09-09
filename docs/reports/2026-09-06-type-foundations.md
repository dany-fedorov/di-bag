# Type foundations: implementation evidence

The two type-foundation tasks and their reviewed runtime correction are
implemented locally. This is an increment report, not a claim that the entire
enterprise program or every compiler-scale target is complete.

## Changes

- Owned registrations are nominal, frozen handles. Spreading or forging one
  cannot preserve its disposal authority. The disposer remains paired with the
  factory's fulfilled result type.
- Ordinary factories cannot require a receiver. Additions reject duplicate
  registrations, including keys hidden by structural narrowing at runtime.
  Replacement requires one explicit existing key.
- Fork overrides use an exact, finite selection tuple. Only selected entries
  affect types and runtime behavior; unrelated getters are not evaluated.
  Runtime selection snapshots indexed tuple entries, not a caller's iterator.
- Explicit generic arguments cannot erase selected override checks. The
  graph-aware inference constraint preserves inline method-returning factories,
  richer selected-to-selected dependencies, owned handles, and exact Promise
  results. The unchecked Bag constructor remains unavailable publicly.
- Builder history uses flat registration entries. Generated strict compiler
  tests exercise actual API calls, consumer assignments, and named negative
  diagnostics without casts or `any` that erase graph checking.
- Failed thenable inspection or observer setup rolls back the acquisition and
  preserves retry/error identity. Internal observation bypasses a native
  Promise's own `then` override while returning the original service Promise.

## Commits and review

| Work | Local commit | Review outcome |
| --- | --- | --- |
| Registration/type boundary hardening | `7a92176` | Two Important findings corrected in the following commit |
| Explicit generic and indexed selection corrections | `aa78ec1` | Both findings addressed; no new findings |
| Flat accumulation and compiler-scale gates | `3a618e4` | Spec compliant, quality approved; no findings |
| Failed observation rollback | `953ccaa` | Original issue addressed; native own-then residual carried explicitly |
| Native intrinsic observer and binding runtime extraction | `4f6aab4` | Spec compliant, quality approved; carried residual resolved, no findings |

The type increment's whole-branch review used the actual branch base
`94d9e52`, not merely its last commit. Its single final fix and scoped re-review
exposed the own-then residual. That load-bearing obligation became the first
mandatory step of the named-module runtime task and passed that task's fresh
review; it was not silently discarded or described as clean before correction.

## Verification evidence

- Type boundaries: independent full check at `aa78ec1`, **96 tests / 323
  assertions**, strict typecheck, declaration build, CJS/ESM consumers and WBS
  example passed.
- Flat accumulation: independent full check at `3a618e4`, **108 tests / 359
  assertions**, strict typecheck and declaration build passed.
- Observation rollback: focused RED had four failures; GREEN passed 29 tests.
  Full check passed **113 tests / 385 assertions**. Independent amended-code
  verification passed **56 tests / 166 assertions**, typecheck and build.
- Native observation: the no-cast own-then regression failed before correction
  with the custom-method error. Before runtime extraction, focused GREEN passed
  **31 tests / 90 assertions** and typecheck. The final extracted runtime's
  implementer full check passed **122 tests / 419 assertions**, typecheck,
  build, real package consumers and the WBS example.
- Independent verification at `4f6aab4` also passed **122 tests / 419
  assertions** in 133.83 seconds, followed by declaration build and the WBS
  example with the expected publication and resource-closure order.

Node package/compiler subprocess checks were run with actual process execution
permitted. Earlier restricted-process failures and incidental package-diagnostic
count changes are recorded explicitly in task reports; they were not treated
as passing evidence.

## Scale: demonstrated improvement and remaining limits

The pre-change 100-add and 100-replacement forms failed with TS2589. Both now
pass, as do 1000 providers composed in registration groups. The repeatable
36-case benchmark accepted **24 cases**, counting intended wrong/missing
dependency rejections as accepted checks. Bulk and grouped graphs passed at
100, 500, and 1000 providers.

The other 12 cases remain open work: 500 individual additions/replacements
exceeded the 60-second worker limit; 1000 single-expression chains overflowed
TypeScript's binder before graph diagnostics. Grouped acceptance is not an
editor-latency guarantee. The 1000-provider grouped valid observation took
15,865 compiler milliseconds and approximately 957 MiB in a fresh Node worker.
These are shared-machine observations, not controlled comparative benchmarks.

Commands, all measured cases, limitations, and the rejected optimization are
in [TypeScript compiler scale](../benchmarks/typescript.md). Actual nominal
module composition is a separate upcoming gate; registration groups are not
misrepresented as modules.

## Decisions and costs

1. Continue in the existing feature checkout under the user's continuous-build
   instruction. Reversing that workflow requires moving local unmerged commits
   to another worktree; it does not authorize a remote push or publication.
2. Use TypeScript's concrete missing-property diagnostic where a conditional
   custom error would destroy contextual inference. The cost is less customized
   wording, not weaker selection validation.
3. Preserve installed consumer constraints invariantly through module, builder,
   and bag annotations. The future module API may need additional retained type
   parameters; the cost is more explicit annotation detail and compiler work.
4. Ownership begins after successful synchronous classification or actual
   thenable fulfillment. A failed inspection cannot safely distinguish a raw
   value from a PromiseLike with erased types, so no raw disposer fallback is
   called. The factory remains responsible for malformed/unobservable values.
5. Internal observation uses the native Promise intrinsic. Custom native
   `then` instrumentation is bypassed for bookkeeping; the original exposed
   Promise and actual fulfilled resource identity remain unchanged.

The overall program still includes tokens, modules, lifetimes, startup,
extensions, box adapters, plugins, compatibility evidence and release handoff.
A separate known binding-keyed edge limitation—catching a dependency failure,
then retrying it through its cached former consumer—remains an explicit
per-acquisition lifecycle acceptance scenario, not an achieved behavior here.
