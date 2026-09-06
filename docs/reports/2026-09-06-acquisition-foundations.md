# Acquisition foundations: implementation evidence

This increment separates retries by acquisition identity and exposes complete
structured cleanup failures. Its task review is clean; the final broad-review
Promise-subclass finding is corrected at `fd83085` and its scoped re-review is
clean. The whole enterprise program is not complete.

## Implemented foundation

At `179fa2e`, cache entries select current attempts while dependency edges retain
actual attempt identities. Caught sync/async/private-module failures no longer
redirect old edges to a retry or create the false cycle. Creating attempts are
not mistaken for cached undefined values. Close permissions belong to each
actual attempt, not its replacement.

`DiBagCleanupError` extends AggregateError. Its frozen failure snapshots retain
acquisition/binding symbols, labels and every original cause, including thrown
undefined. Dependency-ordered cleanup attempts every accepted finalizer;
repeated and reentrant close calls share one barrier. The WBS application keeps
each bag's aggregate rather than flattening scope identities.

The implementation clears mutable acquisition/cache/pending ownership state in
the shutdown finally path. Bag/Builder/Module/ForkContext generic signatures
are unchanged in this increment.

## Verification and review

- Task implementation RED: caught sync/async/private retry false cycles and
  missing aggregate export. Self-review additionally caught disposer receiver
  drift and a stale failed-proxy cycle-label error; both have RED/GREEN tests.
- Exact `179fa2e` implementer full check: **155 tests / 602 assertions**, strict
  typecheck/build, real Node CJS/ESM consumers and both examples passed.
- Controller independent covering check: **67 tests / 261 assertions**, strict
  typecheck/build, package consumers and both examples passed. Unchanged scale
  source was verified unchanged; its full-suite evidence is the implementer's
  run, not a separately repeated controller scale benchmark.
- Task review: spec compliant, quality Approved, no findings. Cannot-verify
  unchanged-contract items were resolved with the evidence above.
- Final broad review covered actual main merge base `94d9e52` through `179fa2e`,
  21 commits. One Important native Promise-subclass ownership finding; no
  Critical or Minor findings.
- Final fix `fd83085`: independent controller verification passed **74 tests /
  300 assertions**, strict typecheck/build, real local/foreign native Promise
  package consumers and both examples. The implementer recorded matching
  covering verification and distinct RED evidence. The scoped review found the
  issue addressed, the amended boundary consistent, and no new breakage or
  out-of-scope observations. Unchanged compiler scale was not rerun for this
  runtime-only fix. No residual, parked or deferred review findings remain.

## Final-review portability decision

The earlier Promise.resolve-before-observation path could call a subclass's
overridden then and record a substituted resource for disposal. A strict
no-cast reproduction preserved the original exposed Promise but disposed the
substitute, leaving the actual native fulfillment untouched.

The selected correction directly observes native Promise state and uses an
independent native pending barrier, not the arbitrary derived species result.
Direct structural thenables must be explicitly converted inside their factory
with Promise.resolve or an async factory. This is a public migration, not an
unchanged compatibility claim; ordinary values and native Promise identity
remain supported.

The portability constraint is substantive: native observation can throw either
for a non-native receiver or during constructor/species setup. Probes made a
native getter throw the exact structural brand-error object and then appear
ordinary on a second read; error type/text/identity and repeated reflection
cannot establish a safe fallback. The ordering is defined in the ECMAScript
[PromiseResolve](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promiseresolve)
and [Promise.prototype.then](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.prototype.then)
algorithms. No host-specific brand hook is added to the core.

## Decisions and costs

1. Execute per-attempt identity and structured shutdown before owned provider
   transformations. If this ordering is wrong, its cost is earlier bookkeeping
   overhead and sequencing rework; no later lifetime/startup obligation is removed.
2. Require explicit structural-thenable conversion while observing native
   Promises directly. If this boundary is wrong, the cost is migrating direct
   thenable factories to standard wrappers and losing implicit raw-thenable
   assimilation. It preserves host independence, original native setup errors,
   and actual fulfilled-value ownership without a speculative brand heuristic.

Existing continuous-program rulings retain the feature checkout and ignored
evidence until the whole program finishes. No publication, push, merge,
credential operation or branch cleanup occurred.
