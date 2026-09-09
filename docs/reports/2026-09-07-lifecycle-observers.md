# Lifecycle observers

Implementation `18b2853` and archive/guidance integration `b5d6575` are committed
on `feat/v0.1`. Independent source, type, package and whole-increment review
approves the work without findings, and all required local completion gates pass.

`DiBag.observe({ onEvent, onError })` returns an immutable facade with an appended
observer. Both receiverless callbacks are required and captured once. Existing
facades, builders and bags retain their configuration; configure preserves
observers, and observation preserves the configured Node Promise classifier.
Portable core continues to require explicit modes or a configured classifier.

Frozen scope, acquisition and accepted-cleanup events carry canonical owner,
binding and attempt identities. Shared and root acquisitions report the real
owner, aliases create no attempt, and contributions and transients retain distinct
identities. Readiness follows the exposed final stage: raw Promise values remain
raw, and a pending native projection is not ready merely because its source
settled. Metadata and frame records are copied and frozen without deep-freezing
application payloads. Original acquisition, cleanup and observer error payloads
retain identity.

A shared microtask delivery queue preserves emission order across observed
facades and visits captured observers in registration order. Delivery runs outside
synchronous factory ancestry, so reentrant operations use ordinary admission
rules. Callback results are monitored only for failure; `onEvent` failures reach
the required `onError`, whose own failures are consumed without recursion.
Callback completion never joins resolution, startup or shutdown ownership.

## Completed evidence

- Focused runtime regression passes 120 tests / 614 assertions, including 13
  observer tests.
- Observer source, consumer, inferred declaration and negative checks pass 3 tests
  / 11 assertions. Physical classic/native `.cts` and `.mts` producers are
  consumed by both compilers after source deletion with `skipLibCheck` disabled.
- Actual archive matrix exits 0: 75 tests / 1,083 assertions in 172.90 seconds.
  Both emitters' physical declarations and Node/Bun CommonJS/ESM runtime lanes
  cover pending final readiness, raw identity, canonical module/sharing ownership,
  cleanup failures, failing/nonsettling observers and reentrant reads/closes.
  Log: `/tmp/di-bag-observers-package.log`.
- Native source audit exits 0: 110 files, 636 expected regions, 609 matched, the
  same 27 existing message-quality gaps, and zero unexpected diagnostics or
  failures. All 14 new observer primary regions match. Log:
  `/tmp/di-bag-observers-native.log`.
- Final native strict typecheck and declaration build exit 0 on reviewed source.
- Final `npm run check` exits 0: strict classic typecheck, 691 tests / 3,657
  assertions in 557.19 seconds, and declaration build. The run used the normal
  process boundary because the managed sandbox intercepts nested Bun/Node child
  processes; a focused unrestricted rerun independently passes all 13 process
  supervisor tests.
- All eight runnable examples exit 0. `examples/observers.ts` prints the expected
  ordered scope, acquisition and cleanup sequence, and its assertions confirm
  cleanup plus the application-owned telemetry completion barrier.
- `git diff --check` exits 0.

## Review and implementation corrections

Independent review approves Task 1 spec/quality, Task 2 scope/quality and the
whole increment without Critical, Important or Minor findings. No correction wave
was required. Its isolated probe confirms that `cleanup-completed` reports
accepted disposer completion while outer attempt bookkeeping can briefly remain
disposing; the event does not promise whole-close completion.

Implementation REDs exposed the missing observe API, cross-facade queue ordering,
grouped event members that defeated filter narrowing, and unnameable inferred
facade/token methods. A shared lazy queue, individually discriminated event
members and type-only root exports `Facade`, `TokenBase` and `TokenMember` resolve
those cases without weakening provider, bag, builder or module invariants. No
native diagnostic allowance or compiler-work ceiling was relaxed.

## Design decisions and costs

- Observation is immutable facade configuration with both callbacks required.
  Callers wanting provider-local hooks or a default error sink supply their own
  convenience wrapper.
- Snapshots are delivered on a microtask queue outside factory ancestry; user
  callback work is never awaited by DI. Applications own telemetry completion
  barriers, as demonstrated in `examples/observers.ts`.
- Callback results are monitored only for failure, and secondary `onError`
  failures are consumed. Applications needing fallback reporting implement it in
  their error handler.
- The fixed schema names metadata, frames, lifetime, `disposalIndex`, completion
  `outcome`, original `error`, and an omitted root `parentScopeId`. Renaming these
  public fields would require an API migration.
- One lazy queue across observed configurations preserves order for callbacks on
  original and appended facades. It couples delivery batches without joining
  callback completion, acquisition ownership or shutdown.

## Remaining program work

Dynamic plugin validation, 500/1000 individual-chain limits, the 27 native
diagnostic-message gaps, broader runtime/bundler/performance evidence, final
adversarial integration and release handoff remain open. Branch export is pending
the existing explicit approval request; no push or publication occurred.
