# Lifetime contract propagation: design investigation

This is read-only architectural advice against `8659198`, not implemented
lifetimes, a selected carrier API, or compiler/runtime verification. The
binding lifecycle design remains
`docs/superpowers/specs/2026-09-06-lifecycle-design.md`.

## Concrete gap

Current module exports synthesize zero-needs public registrations. Module C
retains independent public/external shape requirements, but not private-to-
private topology. Merely adding a lifetime literal to a synthetic public
provider would hide two statically relevant paths:

- Host root -> module transient export -> private scoped provider.
- Private module root -> private transient -> external scoped host provider,
  including a module with no exports.

Finite ordinary dependency annotations already provide compile-time edges;
runtime dependency tuples are not required for those static checks. At runtime
the annotations are erased, so actual reads still need validation. Do not
conflate compile-time declaration information with pre-acquisition runtime
graph inspection.

## Candidate, not adoption

The advisor recommends one additional invariant provider contract containing
lifetime policy and dependency provenance. Metadata and acquisition frames
remain separate. Module C could retain lexical graph capsules alongside its
existing distributive shape rows; public D entries point to their original
local entry in the capsule. This avoids several separate module parameters.

A capsule retains exact local nodes, policies, needs and local-export-to-public
mapping. Lifetime checking follows private edges within their capsule and
public/external edges through the actual current registration table. Rename
must update capsule export references, not just D's outer keys. All independent
private roots remain obligations. Erased/unknown provenance must never become
an empty graph or the ordinary scoped default.

The alternative precomputes capture summaries and unresolved public frontiers.
It could reduce type work but needs a more delicate algebra for policy context,
cycles, private consumers, rename and replacement. Neither approach has been
compiled or measured here. Existing plain complete annotations and current
scale gates must remain explicit compatibility tests; capsule elision requires
a proof that it discards no relevant lifetime obligations.

## Child override decision still open

A child must not promise a richer override while runtime resolves the unchanged
shared root instance. Rejecting overrides of inherited root slots is the
smaller policy. Explicit child shadowing could also be coherent, but needs its
own identity, owner, descendant and root-construction rules. Neither has been
selected by this investigation. Independent forks remain entirely fresh.

## Evidence and remaining work

The advisor read pinned provider/module/type implementations and the governing
specifications; no compiler probes, runtime execution or repository changes
were performed. Full sketch and path semantics:
`/tmp/di-bag-lifetime-contract-advisory.md`.

Before adoption, source/emitted fixtures must cover both paths above,
exportless roots, independent private consumers, export/external rename
collisions, provider transformations, policy erasure, and the chosen child
override policy. Runtime ownership/cancellation and type performance require
separate verification. This report completes no enterprise acceptance row.
