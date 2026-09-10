# Task2 scoped review

Reviewer: /root/review_graph_performance. Range56e502e..8f763c8.
Spec: needs fixes. Quality: needs fixes. One Important finding, no Critical or Minor findings.

## Important: contribution snapshot protection rereads caller input

src/runtime.ts:94 stores Object.freeze([...ids]) but then loops caller-owned ids
again to populate #contributed. A getter-backed readonly array can return target
on the first read and other on the second. The contribution snapshot retains
target, but replacement prunes target because protection contains other.
The additional getter invocation also changes constructor behavior.

Fix: create the frozen array once and use it for sequence storage and protection.
Add a regression checking one caller-input read and continued contributed-target
availability after public replacement.

Focused emitted probe: saved baseline reads1, target present and survives;
current saved final reads2, target present in contribution but deleted from bindings.
No suite rerun. Outside-diff checks limited to snapshot-read contract in
runtime-scale.test.ts:80, emitted reproduction, artifact hashes.

## Other reviewed checks

Persistent trie identity/collision/delete/persistence and native-map oracle,
per-version cache independence and actual WeakRef collection, shared lexical
snapshot reads/current-user counts/iterative pruning, install protection before
release, module declaration/replacement/rename/old-view order all approved.
Warmed-read, bulk/install and live-heap tradeoffs are disclosed honestly.
Paired command/row and summary statistics validated; six baseline heap failures
preserved and every other recorded worker succeeds with clean stderr. Source,
build, probe and archived runtime snapshot hashes verified. Logs show383runtime,
27Nodeperemitter,bothchecks/builds passing. Full portable/package integration
remains controller-owned; Task6 CI repairs outside scope.
