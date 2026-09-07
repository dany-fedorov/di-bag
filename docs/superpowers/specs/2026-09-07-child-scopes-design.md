# Tracked child-scope foundation

Status: execution refinement of the approved enterprise program. Binding parent:
`2026-09-06-lifecycle-design.md`; acquisition classification follows
`2026-09-07-acquisition-classification-design.md`.

## Increment boundary

Implement `bag.scope(): Bag<R, C>` for the existing default-scoped providers.
It shares the immutable binding graph and runtime configuration, but creates
fresh acquisitions, memoization, inspection state and resource ownership.
`fork()` remains an independent root, including when called on a child.
No scope options, overrides, sharing, root/transient policy, cancellation or
startup API are exposed by this increment. Those remain required follow-up;
this increment alone does not satisfy L1/L2/A1.

This is the first production lifecycle slice because it needs no speculative
type-carrier redesign. The advisory lifetime carrier's declaration-size and
lexical-context concerns remain unresolved by this work.

## Runtime boundary

`Runtime` coordinates its own `Acquisitions` and a set of live child runtimes.
Acquisitions continues to own attempt creation, pending observation, retirement,
dependency ordering and finalizers. Do not put an entire child in a fake provider
or copy child finalizers into the parent. Creating a child is lazy and O(1) in
the number of graph bindings, after the existing immutable graph preflight.

The bag constructs children using the runtime's genuine child constructor path;
callers still cannot construct public Bag, Runtime or acquisition handles. A
child's provider/module/token/metadata/acquired-value types and retained module
constraints are exactly those of its parent. Existing checked selected `fork`
behavior works on a child and remains independent.

## Shutdown contract

- `close()` synchronously blocks top-level resolve and child/fork creation in
  that runtime and its entire live descendant tree. It returns the identical
  promise on repeated calls, including reentrant calls from a disposer.
- All live children begin closing before awaiting any one child. Wait for all
  their close outcomes before invoking any parent-owned finalizer. Within each
  bag, retain the existing dependent-before-dependency ordering and fixed-point
  acquisition drain. In-flight factories retain the current permission to read
  their dependencies while closing; new top-level calls do not.
- A child can close independently without closing or disabling its parent or
  siblings. An independently created fork is not included in tree shutdown.
- A child remains tracked until its close promise settles. Detach it on either
  fulfillment or rejection, releasing parent-to-child and child-to-parent links.
  A parent snapshot taken while that child is still closing includes its outcome.
  Once detached, its independently handled failure is not replayed by a later
  parent close. The caller of an independent child close owns that result.
- Aggregate original structured `CleanupFailure` records from all children and
  then the parent into one `DiBagCleanupError`. Child registration order defines
  cross-child failure order, independent of completion timing. Parent failures
  follow child failures. Nested trees flatten records without duplicating causes
  or finalization, including thrown `undefined`. Every applicable parent and
  child finalizer is attempted even if another fails.
- Detachment bookkeeping must not create an unhandled derived rejection or
  replace the exact public closing promise. It must not suppress rejection of
  that public promise for callers that explicitly await it.
- A parent's own acquisitions enter closing immediately, even while descendants
  are draining. Introduce a narrow internal drain prerequisite if needed;
  delaying the call to the existing acquisition close until children finish
  would incorrectly leave parent resolution open.

Snapshotting all live child promises plus retaining one original acquisition
close barrier is preferred over a separate general scheduler or a parallel copy
of the acquisition state machine. Costs: O(live child scopes) parent bookkeeping
and a child-results array during shutdown. A non-settling child acquisition can
keep parent close pending; cancellation and prompt startup deadlines are later
work, not silently supplied here.

## Existing empty-selection follow-up

For `fork([], overrides)`, preserve validation that the selected keys are an
array and overrides is a non-null object. Do not read any unselected getter or
iterator. Once the indexed selection is empty, reuse the immutable graph;
the fork still owns fresh acquisitions and has no child relationship. The
internal `BindingGraph.withPublicBindings([])` operation should likewise return
the same graph. This closes the carried M1 performance finding with exact graph
identity evidence, not a timing benchmark.

## Acceptance

Runtime tests cover child/grandchild identity, lazy creation, parent-first and
child-first resolution, pending promise deduplication only within each scope,
module-private isolation, configured portable core, native shadowed-then and raw
Promise ownership, independent forks, independent child closure/detachment,
immediate closing gates, late dependencies, reentrant close, all-child start,
child-before-parent finalization, original multi-failure aggregation and empty
selection graph reuse. Use controlled deferred promises, not timing sleeps.

Strict source and physical declaration-only consumers prove unchanged Bag R/C
contracts, exact sync/Promise values, nominal tokens, metadata and acquired-value
types. Negative calls reject missing public keys, private module names, forged
tokens, invalid child fork replacements and unsupported scope arguments. Execute
actual Node/Bun CJS/ESM consumers of packed artifacts from classic and native
emitters. Preserve the existing native diagnostic gaps; new scope fixtures must
have useful matched diagnostics and no new gap allowances.
