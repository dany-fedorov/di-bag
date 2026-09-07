# Tracked child scopes: implementation evidence

This increment adds tracked, default-scoped children while leaving the enterprise
lifetime and startup program open. `Bag.scope()` preserves its parent's exact
registration and retained module contracts, reuses the immutable binding graph,
and owns fresh lazy acquisitions. Parent shutdown closes the live descendant tree
before parent-owned finalizers. Independently closed children detach after their
public close settles; forks remain independent roots.

## Package and declaration boundary

The shared installed-contract corpus now includes the positive and negative scope
fixtures. Positive consumers retain exact root/child/grandchild Bag equality,
non-`any` inference, synchronous and Promise-valued services, nominal tokens,
module-private isolation, metadata and raw-owned Promise types. Every negative
scope marker must match a useful diagnostic in its exact region; no native gap
allowance was added.

For each classic TypeScript 6 and native TypeScript 7 package emitter, the archive
is installed into separate CommonJS and ESM consumer directories. The scope
producer is emitted by the selected emitter, its source directory is physically
removed, and both native and classic downstream programs must load the resulting
`.d.cts` or `.d.mts` with zero diagnostics. The installed archive is also executed
by Node and Bun in both module modes. Those processes assert parent/child identity,
child-before-parent cleanup, independent fork survival and final fork ownership,
then emit the exact JSON `{"log":[2,1,3]}` with empty stderr and exit status zero.

## Genuine package RED and correction

The first physical-emission run failed in both selected emitters. Classic reported
TS2742 and native reported TS2883 for each unannotated `root`, `child` and
`grandchild` export: the inferred declarations could not name `Entries` from the
installed package's internal `dist/types` module. This was a real package boundary
failure; the earlier source fixtures were already green.

The correction is a type-only root export of `Entries` beside the existing public
`From` and `Provided` helpers. It adds no runtime export or dependency, preserves
the unchanged unannotated producer, and avoids a fixture annotation that would
sidestep the inference requirement. With that single naming correction, both
emitters produced portable declarations and every source-erased downstream
consumer passed.

## Verification evidence

The implementation used pinned Bun `/home/df/.bun/bin/bun` 1.4.0 and Node
`/home/df/.volta/tools/image/node/24.20.0/bin/node` 24.20.0. Compiler lanes are
classic API 6.0.3 through the 6.0.2 wrapper and native 7.0.2.

- Initial strict classic installed scope route: 4 tests passed with 20 assertions;
  no feature RED was fabricated for this already-green source contract.
- Genuine physical package RED: 2 tests failed after 140 assertions. Both package
  emitters rejected the unnameable `Entries` references described above.
- Corrected physical/archive run: 2 tests passed with 296 assertions. It covered
  both emitters, both declaration modes, eight installed runtime executions
  (Node/Bun times CJS/ESM times two emitters), physical source removal and dual
  native/classic downstream checks. Only the existing incremental-fixture gaps
  were reported; all new scope regions matched strictly.
- Focused classic runtime route: 2 tests passed with 4 assertions. The subsequent
  strict scope fixture rerun passed 4 tests with 6 assertions.

- `npm run check` exited zero: strict classic typecheck, 457 tests / 2,329
  assertions with zero failures, and the classic declaration build all passed.
- `npm run typecheck:native` and `npm run build:native` each exited zero.
- `npm run check:native` exited zero over 86 files: 349 primary expectations,
  322 useful primary matches, the unchanged 27 known rejections, 11/11
  supplemental matches, zero unexpected diagnostics and zero failed files. The
  positive scope producer/consumer had zero diagnostics; all seven scope negative
  markers matched useful diagnostics with no gap declaration.
- All four examples exited zero under Bun 1.4.0: WBS ownership, named modules,
  box adapters and typed tokens. Final `git diff --check` also exited zero.

## Review and independent verification

Both task reviews approved their respective changes. Broad integration review
of the branch through `2ae140e` found no Critical or Important issue; it retained
two optional polish findings for shutdown wording and success-path test logging.
The final polish commit `9ff1911` changes neither runtime ownership nor compiler
assertions. Its covering package run passed two tests and 296 assertions with no
default diagnostic JSON. Scoped re-review confirmed both findings addressed and
found no new breakage.

Independent committed-code checks passed 36 runtime/boundary/graph tests with
147 assertions and two scope type tests with six assertions at `6a5ea61`.
The real archive/declaration harness independently passed again at `2ae140e`:
two tests, 296 assertions, 43.97 seconds, both emitters, both downstream compiler
lanes, and eight Node/Bun CJS/ESM executions. These checks supplement the full
457-test implementation run; they do not claim a new historical scale matrix.

## Decisions and trade-offs

1. Deliver tracked default child scopes before lifetime policies. This preserves
   existing contracts while ownership is verified; the cost is a separate later
   policy integration increment.
2. Detach independently settled children and leave their close result with their
   caller. This releases tracking references; a later parent close does not
   replay that earlier independently handled failure.
3. Preserve the existing feature checkout and evidence workspaces, with one
   implementation writer. The cost is working without another isolated worktree.
4. Reject all supplied `scope` arguments, including unchecked JavaScript options.
   This prevents silently ignored sharing intent; `scope(undefined)` also rejects.
5. Prove module-constraint retention with exact Bag equality and a direct erasure
   negative. An initially widened external provider was already invalid; the
   replacement proof costs one explicit fixture and avoids misleading evidence.
6. Export `Entries` as a type-only public helper after both emitters required it.
   This preserves unannotated inference; the public helper name must be maintained.

## Remaining program work

This closes the carried M1 empty-selection graph-reuse finding, not the enterprise
lifetime or startup rows. Root and transient policies, configurable explicit
sharing, captive-dependency checks, eager startup, partial-startup cleanup,
cooperative cancellation and shutdown deadlines remain required. Accordingly L1,
L2 and A1 remain incomplete.

## Self-review

The package harnesses reuse the existing build/archive/install and compiler
routes. Runtime assertions inspect status, signal, termination reason, stderr and
exact JSON rather than treating installation as execution evidence. Scope fixtures
receive no native diagnostic exception. The only added public surface is the
type-only helper required to name the already-public inferred Bag contract.
