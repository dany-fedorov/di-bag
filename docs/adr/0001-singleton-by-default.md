---
status: accepted
---

# Retain scoped as the default lifetime

DI Bag retains `'scoped:one-per-container'` as the unmarked provider lifetime because the
measured singleton-default type shape failed the S8 compiler budget recorded in
`docs/superpowers/plans/evidence/phase-10.md`. Explicit
`'singleton:one-per-container-tree'` and `'transient:one-per-resolve'` policies remain
available.

A child container may replace scoped and transient services, but it may not replace an
explicit singleton; use an independent container when the replacement must rebuild the
whole graph. Both TypeScript and runtime enforce that rule. The singleton-captures-scoped
check and module obligations retain their phase-9 behavior, including renamed external
requirements.

## Considered options

- Make singleton the default with a no-scoped-service fast path. S8 failed the recorded
  diagnostic-location, instantiation, or compiler-ceiling rule, so the release uses its
  specified fallback.
- Select a default per builder. This makes installed module meaning depend on the host.
- Use NestJS-style scope bubbling. Lazy Proxy dependency discovery cannot determine the
  complete graph before acquisition.
- Remove child containers. That loses tracked request ownership and parent singleton sharing.

## Consequences

Existing unmarked providers keep their 0.4 per-container instance behavior and need no
lifetime-pin migration. Singleton providers stay explicit. The new child replacement rule
prevents an explicit singleton consumer from silently retaining an inherited dependency.
