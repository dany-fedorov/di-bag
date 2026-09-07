# Eager startup and acquisition context

Implementation on `feat/v0.1`, based on `d23b1d2`. Binding design:
`docs/superpowers/specs/2026-09-06-lifecycle-design.md`; execution plan:
`docs/superpowers/plans/2026-09-07-startup-context.md`.

## Delivered behavior

- `Builder.start(keys, options?)` creates a fresh bag and eagerly acquires only
  selected services and the dependencies they request. It retains end-equivalent
  named/token/module/lifetime validation and finite tuple selection.
- Parallel startup begins selections without waiting between them. Sequential
  startup waits for each selected acquisition and stops after failure. Repeated
  transient selections retain independent acquisition identities and ownership.
- `DiBag.withContext` supplies a frozen owner context with an AbortSignal while
  preserving exact named requirements, output/acquired types and explicit modes.
  Root, scoped and transient signals follow the existing ownership rules.
- Tree admission closes synchronously; cooperative abort runs before acquisition
  draining. Children and independent forks cannot abort their parent owner.
  In-flight sources retain permission to complete their dependency graph, with
  already-aborted contexts for late contextual dependencies.
- Normal startup failure awaits shutdown and retains setup cause, structured
  cleanup failures and the original cleanup error. Abort and deadline expiry
  reject promptly with a separate, internally observed eventual-cleanup promise.
  Cancellation can interrupt the wait for ordinary failure cleanup too.
- Options and indexed selections are snapshotted before acquisition. Already
  aborted signals and invalid inputs start no factories. Listeners/timers are
  released on every normal outcome; long deadlines avoid host timer overflow.

## Review and regression evidence

The initial 12 runtime tests failed because `start` and `withContext` were absent.
The covering pre-change lifecycle baseline passed 72 tests / 360 assertions.
The final focused startup suite covers 22 scenarios, including lifetime/context
identity, late ownership, original thrown `undefined`, cleanup failures, token
selection, duplicate transients, option accessors, listener release and deadlines.

Independent runtime review found one Important issue: readiness initially waited
for every pending stage, which could block a ready native projection behind its
still-pending source. A new test reproduced a startup timeout. Readiness now waits
only for the final stage's private native barrier; shutdown still drains every
stage. Both the fulfilled-projection case and a failed projection whose source
waits for cooperative abort are covered. Review confirmed the correction and
reported no remaining production findings.

The final compiler/package/documentation review found one Minor test weakness:
a single microtask did not prove pending native readiness. Source tests and
the installed runtime fixture now wait a full event-loop turn before checking
that a native Promise with shadowed `then` remains pending. The original gate
is released only after that assertion.

## Verification ledger

- Final `npm run check` with subprocess permissions: exit 0, 528 tests / 2,714
  assertions across 30 files, zero failures (411.94 seconds for the test suite),
  strict classic typecheck and declaration build. No source or test changes
  followed this run; final edits record completion and evidence only.
- Native source audit: exit 0, 92 files; 424 expected diagnostics, 397 direct
  matches, 27 unchanged previously recorded native diagnostic-quality gaps,
  zero unexpected diagnostics and zero failed fixtures. All 17 new startup
  diagnostic regions match directly, with zero new allowances.
- Classic source tests verify exact inferred startup/context contracts and all
  17 negative regions. Native strict typecheck and declaration build pass.
- All four existing examples pass from source.
- The subprocess-enabled covering run passes 142 tests / 1,090 assertions,
  zero failures, across startup, process supervision, actual box packages, public
  package consumers and both classic/native emitted archive lanes. Both archives
  execute startup on Node/Bun in CommonJS/ESM (eight combinations) and preserve
  inferred startup/context declarations with producer source physically removed.
- The first full sandboxed run encountered environment failures: Node
  `spawnSync(process.execPath, ...)` returns `EPERM`; Bun reports empty output
  from the same forbidden spawn. This invalidates the subprocess/package lanes,
  rather than demonstrating a library failure. The local checks were rerun with
  subprocess permissions and passed; no assertion or acceptance limit was weakened.
- `git diff --check` passes. Implementation and verification used the existing
  `feat/v0.1` checkout. Package publication remains a separate release step.

## Boundaries and follow-up

This increment implements the startup/context portion of the lifecycle design.
Selected sharing, child overrides, composition adapters/aliases/optional/lazy
dependencies/contributions, observers/plugins, large individual TypeScript
chains, the 27 native diagnostic-quality gaps, broader bundler/performance
evidence and final release handoff remain open. A timeout cannot forcibly stop
arbitrary JavaScript; eventual cleanup can remain pending for uncooperative work.
No package version, dependency pin or publication configuration changes.
