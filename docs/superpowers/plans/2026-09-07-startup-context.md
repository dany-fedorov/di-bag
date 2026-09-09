# Eager startup and acquisition context implementation plan

> Execute task by task using the planning, test-driven-development and verification skills. Review the completed change with the requesting-code-review skill.

**Goal:** Implement the approved A1 lifecycle behavior: selected eager startup, cooperative scope cancellation, deadlines and eventual cleanup.

**Architecture:** Keep acquisition readiness inside ProviderExecution. A startup coordinator creates a fresh runtime, snapshots its selection/options and waits on internal readiness barriers. Each acquisition owner supplies a frozen context backed by its own AbortController; the controller stays private. Separate startup cancellation from eventual resource cleanup.

**Tech stack:** TypeScript 6 classic / TypeScript 7 native, Bun tests, Node/Bun package consumers.

**Spec:** `docs/superpowers/specs/2026-09-06-lifecycle-design.md`, especially Cooperative acquisition context and Startup, cancellation, and deadlines.

## Global constraints

- No required decorators, reflect-metadata, parameter-name parsing, custom compiler transforms, or dynamic code generation.
- Preserve exact synchronous versus Promise-valued service types; never silently await an ordinary factory dependency.
- Preserve `DiBag.withDisposal` and explicit owned-versus-borrowed intent; method names alone never transfer ownership.
- Test production behavior and compile-time contracts, including negative fixtures; record failing evidence before implementation.
- No publication, remote push, or credential storage without a separate explicit request.

## Refinements

`withContext(callback, options?)` accepts the same explicit acquisition modes as token adapters. Its callback's first parameter remains the named dependency contract and its second parameter is AcquisitionContext. The adapter retains exact output and acquired types through existing transformations. Signals belong to the owner: child-first roots receive the root signal, scoped/transient providers receive their owning scope's signal. Ordinary close initiates cancellation after synchronously closing the tree's admission gates, before draining acquisitions. An independent fork gets an independent signal.

`start(keys, options?)` requires the same completion constraints as end(), including private module and captive requirements, and the existing finite selected-key admission. Runtime selection uses indexed tuple entries, never a custom iterator. Invalid selections/options reject before effects; option keys are preflighted and read once. External signals apply only during startup, with listeners removed on settlement. Duplicated keys resolve according to ordinary lifetime policy, so repeated transients are separate acquisitions.

Parallel startup initiates all selected acquisitions unless cancellation intervenes; sequential startup stops after the first failure. Normal failure waits for close and preserves the original cause plus structured cleanup failures. Cancellation may interrupt that wait and yields a promptly rejected DiBagStartupCancelledError with an observed, externally awaitable cleanup promise. A timeout is finite and positive; long durations must not overflow host timer limits. Timers/listeners are released on every exit. Raw Promise/thenable values are ready without assimilation; native shadowed-then values await internal observation. Selected-sharing and override policies remain a separate increment.

## Task 1: Context and internal readiness

Files: `src/acquisition-context.ts`, `src/provider-operations.ts`, `src/provider-execution.ts`, `src/acquisition.ts`, `src/runtime.ts`, `src/di-bag.ts`, `src/index.ts`, `tests/startup.test.ts`.

- [x] Add tests where parent/child/root callbacks return their frozen contexts, close only the child, and assert only child-owned signals abort. Cover retained dependencies after abort and independent forks.
- [x] Verify the tests fail because withContext is absent.
- [x] Implement authenticated contextual source descriptions and lazy owner contexts. Expose internal `acquire(key): Promise<void>` readiness without observing exposed `.then` methods or creating a second transient.
- [x] Re-run context tests and existing acquisition/lifetime/scope tests.

## Task 2: Startup coordinator and public contracts

Files: `src/startup.ts`, `src/errors.ts`, `src/di-bag.ts`, `src/runtime.ts`, `src/index.ts`, `tests/startup.test.ts`, `tests/types/startup.ts`, `tests/types/negative/startup.ts`.

- [x] Add controlled-deferred tests for selected-only readiness, parallel/sequential order, raw/native modes, original failure and cleanup errors, already-aborted signals, late ownership after cancellation, deadline cleanup and invalid boundaries.
- [x] Run them RED before implementing the coordinator.
- [x] Implement `Builder.start` with end-equivalent closure and finite named/token selection. The coordinator snapshots inputs, creates the runtime, subscribes to cancellation, starts selected acquisitions, and exposes the fresh bag only on success.
- [x] Add positive equality/inference checks and diagnostic-marked negatives for closure, selection, context and options. Run classic and native source checks without new diagnostic allowances.

## Task 3: Package evidence, documentation and review

Files: existing package harness and fixture helpers, `README.md`, `CHANGELOG.md`, `docs/migrations/0.1-to-enterprise.md`, enterprise plan and a startup evidence report.

- [x] Extend actual installed classic/native archive consumers with unannotated startup/context exports, physical declaration-only checks and Node/Bun executions.
- [x] Document API examples, cancellation/cleanup boundary and remaining enterprise scope.
- [x] Run `npm run check`, native typecheck/build and targeted native/package gates. Record actual results.
- [x] Request scoped independent review, fix material findings and run covering checks before the final handoff.

All tasks are complete. Final verification: `npm run check` exits 0 with 528
tests / 2,714 assertions, strict typecheck and build. Native source/typecheck/build,
physical package declarations and Node/Bun runtime lanes also pass. Review fixes
and the initial sandbox subprocess restriction are recorded in
`docs/reports/2026-09-07-startup-context.md`. The wider enterprise program remains
open.
