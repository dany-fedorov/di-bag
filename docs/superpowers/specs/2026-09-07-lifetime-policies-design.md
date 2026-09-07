# Root, scoped and transient policy integration

Date: 2026-09-07. Implementation refinement of the approved
`2026-09-06-lifecycle-design.md`, following the completed tracked-child-scope
checkpoint `baebef5`. This is the next L1/L2 increment, not completion of the
enterprise program. Acquisition classification and stage ownership remain as
specified in `2026-09-07-acquisition-classification-design.md`.

## Boundary and delivery order

Implement lifetimes against the existing no-argument `scope()` first. Every
child currently uses the same immutable binding graph as its family root, so
root construction has an unambiguous binding context. Selected sharing, child
overrides, context signals and startup are separate increments. Do not silently
accept scope options. `fork()` continues to create a new independent family.

Land the internal declaration/type integration first, then runtime routing and
the public facade together, then actual package evidence. The internal helper
must not be exposed as a working public lifetime API before runtime semantics
exist. Intermediate commits are explicitly authorized; their documentation must
state which part is implemented.

## Declaration and transformation contract

The final public operation is `DiBag.withLifetime(registration, lifetime,
options?)`. Lifetimes are `root`, `scoped`, and `transient`. Unwrapped factories
and providers are scoped. The operation changes only caching policy: retain the
exact factory requirements/output, metadata, frame tuple, token contracts and
acquired value. It does not call the factory, await a value, transfer ownership,
change an owned stage, or infer cleanup from a method name.

Only a root declaration accepts `captureScoped`. An absent option or false is
strict; literal true deliberately permits root-context scoped capture. A boolean
not statically known to be true remains strict for static validation. Reject
this option for scoped/transient even when its value is false or undefined.
Require an individually known lifetime literal at the typed boundary, not a
widened string or union whose selected ownership policy cannot be known.

Runtime validation precedes factory execution: reject invalid lifetime values,
non-object/null/array options, unknown own option keys and invalid capture
values. Snapshot the supported own option once; do not retain the caller's
mutable options. An omitted/undefined options argument is equivalent to no
option. Options inherited from a prototype are not supported declarations.

An outer lifetime wrapper replaces the earlier cache policy for that provider.
It does not append an acquisition stage. Moving from capturing root to strict
root or transient clears the earlier capture permission. Reusable input handles
remain unchanged. The authenticated immutable description gains one immutable
`lifetime` record, with `kind` and `captureScoped`; normalization retains it.
Metadata transformations must copy the whole description, not reconstruct a
subset that drops this or future policy fields.

## Retained static graph

Keep Provider's existing F/M/A/G/V dimensions and Module's P/R/C/D dimensions.
Extend the structural G contract with lifetime and, where necessary, lexical
source information. Rebinding changes only token binding information; it must
retain extensions. Erased/opaque registrations do not become concrete scoped
proofs merely because they have been wrapped.

At graph completion (`Builder.end`) and independently overridden `Bag.fork`,
validate each strict root. Follow its declared named and token dependencies
through transient intermediaries. Reaching a scoped registration rejects with a
useful captive-dependency diagnostic. Reaching another root ends that traversal:
the other root has its own independently checked strict/capture boundary.
Therefore strict root A may consume root B that explicitly permits root-context
capture; unrelated strict roots do not inherit B's permission. Visiting a cycle
must not hide another branch that reaches scoped state. Existing incremental
shape/token checks keep their current timing and precision.

A module export with root/transient policy retains its original local source,
local registrations and export-to-local mapping. Traversal resolves a local
exported name through its current public slot, a private name through that
module's local registrations, and an external name through the host graph.
Rename changes public mappings only. A later host registration with the same
name as a private binding must never replace that private target in validation.

Retain independent obligations for private root registrations in Module C,
including exportless modules. Public roots are checked through the current
public registration map: replacing an exported root removes that original
public root's lifetime obligation, while private root obligations remain.
Existing retained module shape constraints are not removed by this rule.

For this no-argument-scope increment, a default-scoped public export does not
need lexical lifetime traversal: a strict root rejects at that first scoped
edge. A module without private root obligations and without non-default public
policies can retain the legacy lightweight representation. This is a limited
elision rule for captive checks, not a proof for later partial sharing or child
overrides. Explicit scoped policy can normalize back to the default carrier.

Guard the existing default Provider/Module/Bag annotations, NoInfer unions,
reflected methods, exact inferred producer declarations and negative diagnostic
locations. The prior throwaway carrier experiment is advisory only; actual
production compiler and package checks decide whether this representation works.

## Runtime ownership and validation

Each scope retains local attempts and scoped cache entries. A family shares an
attempt index for dependency-edge traversal and failed incoming-edge retirement;
closed/retired child attempts must be removed from that index. Root requests
route to the family root's acquisitions and graph before construction or cache
lookup. Transients always create a fresh attempt owned by the resolving scope,
or by the owner of the acquisition requesting the dependency.

Each root establishes a strict/permissive capture boundary. Strict boundaries
flow through transients and reject a scoped dependency before returning a cached
value or creating a new attempt. Root dependencies establish their own boundary.
Dependency proxies retain these rules after `await`. Public unchecked calls
therefore cannot silently bypass declared lifetime ownership.

Use binding-and-owner ancestry to detect repeated transient construction, not
only acquisition IDs. Synchronous public reentrancy also needs a construction
stack; two independent pending transient calls are not a cycle. Preserve the
existing acquisition-ID graph checks for cached/mixed and post-await cycles.
Failed/retired ancestors must not create false cycles on legitimate retries.

Retirement abandons unsuccessful incoming edges across all family owners but
retains outgoing edges and accepted stages until rollback finishes. Never
substitute a retry's ID. Local disposal orders only locally owned acquisitions;
ancestor-owned dependencies are borrowed. Tree shutdown supplies child-before-
parent ordering, including late root acquisitions by in-flight child work.

`inspect` remains non-resolving. Root binding inspection reads root attempts;
scoped/transient inspection reads attempts owned by the inspected scope. Keep
the current immutable snapshot shape. Multiple transient attempts remain visible
and independently owned even if their factories return the same object.

Preserve exact original Promise identity/state classification, fixed-point
draining, additive owned-stage cleanup, original cleanup causes, same closing
promise, and independent child detachment. Cancellation/startup are not implied.

## Acceptance gates

- Root identity is shared across children/grandchildren even on child-first
  construction; fork identity is independent. Scoped identity differs per scope;
  transients differ per call, with one cleanup per transferred attempt.
- Root/transient wrappers preserve acquired values, metadata, frames, tokens and
  lexical module provenance through all transformations and replacement paths.
- Direct/intermediary named/token captives reject statically and at observed
  runtime edges, including cached dependencies and post-await property reads.
- Private/transient exports, rename collisions, exported-root replacement,
  private/exportless root obligations, mixed unions and erased views are covered
  by positive equality checks and genuinely useful negative diagnostics.
- Strict A -> explicitly capturing root B is valid; separate strict C -> scoped
  remains invalid. Capture permission never redirects construction into a child.
- Retried root failures retire cross-owner incoming edges, transient synchronous
  reentrancy and post-await cycles fail deterministically, and concurrent pending
  transient requests do not create false cycles.
- Child shutdown does not dispose root attempts; parent shutdown waits on child
  work then disposes root resources. Multiple cleanup failures retain all causes.
- Classic and native source/declaration consumers retain exact unannotated types,
  including physically erased producer sources. Real Node/Bun CJS/ESM consumers
  execute both emitted archives. No new diagnostic allowance may hide a lifetime
  rejection, and no timeout/OOM counts as a useful compiler error.

## Trade-offs

End/fork lifetime validation avoids walking the whole transitive graph on every
builder addition, at the cost of reporting captivity at graph completion.
Retained lexical information increases declarations for policy-bearing modules;
default modules keep the existing representation. A family attempt index costs
shared bookkeeping and requires explicit release, but preserves cross-scope retry
identity and cycle checks. Deferring scope options avoids guessing how a new
child-declared root would be constructed; those options remain visibly absent.
