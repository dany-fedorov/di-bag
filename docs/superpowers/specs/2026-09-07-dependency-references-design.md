# Explicit optional and lazy token dependencies

Follow-up E1 design under the approved enterprise program. Class and positional
adapters precede this change. This document specifies the next composition
boundary; it does not claim implementation or reduce the remaining alias and
contribution requirements.

`DiBag.optional(token)` and `DiBag.lazy(token)` return genuine immutable reference
handles, accepted alongside ordinary tokens by `fromTokens`, `fromFunction` and
`fromClass`. Each wraps one genuine singleton token, preserving its nominal
identity and service contract in an invariant type carrier. They cannot be used
as binding identities, reconstructed by object spread, or forged structurally.
Ordinary token tuples remain source-compatible. The reference tuple must still
be finite with every element individually known.

An ordinary token supplies its exact service value, including a Promise. An
optional reference supplies `Service | undefined`: only an absent binding returns
undefined. An existing binding with an incompatible contract is a compile error;
existing factory failure, a cycle, native rejection or other acquisition failure
must propagate without being converted to absence. An existing binding whose
service value is itself undefined remains a present acquisition for ownership.
No fallback callback, implicit awaiting or blanket catch is introduced.

A lazy reference supplies `() => Service`. Creating the function does not resolve
the dependency or record an acquisition edge. Each invocation resolves in the
capturing provider's acquisition context and records the observed edge. Scoped
and root dependencies use their existing cache; transients create an attempt per
invocation. Lazy declaration does not remove graph completeness: missing or
incompatible lazy targets still fail composition. Invoking the closure during
construction participates in cycle detection; invoking it after owner closure
rejects. In-flight sources keep exactly their existing shutdown admission rules.
Lazy references are useful for a later method call, not permission to outlive the
owner or to hide an invalid lifetime capture.

The initial wrappers each accept a token, not another reference. This keeps their
presence and call signatures unambiguous. Combined lazy-optional references are
not required by the parent acceptance matrix and are not implicitly invented by
wrapper order.

Runtime provider descriptions retain immutable argument-reference records.
Internal argument slots map to real lexical token keys, so module-private tokens,
renamed public exports, child overrides and shared owner routing keep using the
binding graph. Optional lookup tests binding existence before acquisition rather
than catching resolution errors. Lazy functions close over the same attempt
admission and dependency-read path as ordinary proxy reads. Do not add public
magic service names or expose the runtime's resolver/controller.

The provider graph retains required and optional token obligations separately.
Required tokens include lazy references; optional tokens participate in shape/
nominal checking whenever present but never in missing-factory checks. Incremental
builder validation, full graph validation, retained private-module constraints,
renames, replacement/fork/scope checks and declaration exports must all preserve
that distinction. Module external requirements may describe optional services as
optional properties; absence must not block installation or graph completion.
Public provider views clear local obligations only when the module's invariant
constraint carrier retains them. Opaque/erased providers cannot silently prove
these contracts.

Static root-captive walks include every declared optional target that is present
and every lazy target. Runtime checks remain on observed reads, before owner/cache
routing. A strict root cannot conceal a scoped dependency through either wrapper;
explicit capture retains its existing root-context policy.

Acceptance includes absent/present/undefined/throwing/rejected optional targets,
wrong optional token contracts, lazy creation timing and repeated transient
invocation, ready and pending cycles, retained closures during/after shutdown,
root/child sharing and override contexts, private module requirements and renames,
raw/native Promise values, explicit disposal, forged descriptors, tuple mutation,
receiver/arity checks through all three positional adapters, and exact inferred
physical classic/native package contracts. All package runtime lanes must execute
actual assertions; no new native diagnostic-gap allowances are permitted.
