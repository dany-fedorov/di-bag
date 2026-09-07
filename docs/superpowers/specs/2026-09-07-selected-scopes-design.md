# Selected sharing and child overrides

Execution refinement of the approved enterprise/lifecycle design. Continue under
the user's authorization to implement, verify, and push `feat/v0.1`.

`bag.scope()` retains its existing behavior. `bag.scope({ share: ['service'] })`
borrows selected parent acquisitions. `bag.scope(['config'], { config: factory },
{ share: ['service'] })` additionally replaces exactly the selected public slots.
The options argument is optional for the override form. Both selections reuse
the finite tuple and genuine-token rules of `fork`; hidden override properties
are ignored. Override values retain the existing assignability and complete-graph
checks. Unknown options, missing selected overrides, invalid handles, transient
sharing, and share/override conflicts reject before reading override values.
Tuples are snapshotted by index before getters, without invoking their iterators.
Share options are snapshotted once. An empty selection reuses the binding graph.

Sharing borrows a cached parent acquisition, including its exact exposed Promise,
metadata, dependency graph and cancellation context. It does not eagerly resolve
the parent, copy its finalizers or affect unselected dependencies. A grandchild
must select sharing again for scoped bindings; root lifetime remains inherited
automatically. Sharing a root is permitted and redundant. Transients reject
because they have no single cached parent acquisition to borrow.

Unchanged root bindings construct in their original root context even when first
requested by a child. A root binding introduced by a child override is anchored
at that child and shared with its descendants; it cannot be inserted into the
ancestor's immutable graph. Its dependencies use the defining child's graph.
An inherited root still sees its original bindings even when its dependencies
are overridden in a child. Ordinary overrides are child-scoped unless explicitly
decorated. Root captive checks validate newly introduced roots in the child graph;
inherited roots were validated in their original graph and do not acquire through
child overrides. Independent forks revalidate all roots against their new graph.
Retained module requirements and selected output compatibility remain checked.

Routing follows binding identity through the parent chain. Inspection follows
the same owner route, returning copied snapshots. Shared pending acquisitions
deduplicate and failed attempts retry at the owner. Child shutdown cannot abort
or dispose a borrowed parent acquisition; parent shutdown closes children first
and allows their in-flight sources to discover parent dependencies before drain.
Observed cross-owner edges retain cycle detection, failure retirement and cleanup
order. No acquisition owner is inferred from equality of returned objects.

Verification requires runtime identity/ownership/cancellation tests, adversarial
selection tests, source and physical declaration-only classic/native consumers,
and actual Node/Bun CJS/ESM packed execution. No new native diagnostic gap is
allowed. This closes selected-scope lifecycle work only; the remaining enterprise
composition, observers/plugins, compiler and release milestones stay required.
