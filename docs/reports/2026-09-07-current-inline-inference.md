# Current inline inference evidence

Read-only probes against `b505d660eb4fd27badc5001066fbf199b2ba410b`, TypeScript 5.9.3
and Node 24.20.0 confirm both required inference follow-ups remain unresolved.
Every compiler child had a 10-second timeout and 512 MiB old-space cap. No
production change is adopted by this report.

## Selected async fork overrides

The inline reproduction in [the original report](2026-09-06-inline-fork-inference.md)
still rejects the annotated async consumer requiring the richer selected service:
TS2322 at the callback, followed by TS2339 when using the lost richer output.
Predeclaring the identical object works without a type annotation or cast and
retains `{read():number;extra():boolean;richer():number}` and `Promise<number>`.
Both results reproduce in source and emitted declaration consumers.

A virtual change to ForkContext's preliminary dependency context accepts that
inline case while retaining the actual selected-output and final graph checks:

```ts
unknown extends O
  ? { [P in keyof R]: any }
  : Provided<Merge<R, Selected<K, O>>>
```

The missing-richer negative still rejects. Expanded source and emitted checks
retain 193 expected diagnostic regions / 203 diagnostics across 31 root fixtures,
including token G, module C, provider metadata and acquisition-frame contracts;
no expected message is missing and no positive fixture has an extra diagnostic.
The corrected expanded emitter includes all three public entrypoints and emits
17 declaration files. These are region-based existing fixture checks, not 193
distinct exact-line assertions. No full suite, actual packed consumer, scale
matrix or exhaustive explicit-generic proof was run for this candidate.

The preliminary `any` remains an adoption concern. An unannotated destructured
async callback has TS7031 in both baseline and candidate; its error-recovery
`Promise<any>` is not an accepted exact contract. This sketch fixes one measured
inference interaction, not all contextual inference.

## Nested val-box snapshot factory

The existing structural snapshot-protocol reproduction still fails inline with
TS2345 (`invalid val-box snapshot capability`) and six exact-type assertion
failures. Predeclaring the identical factory passes all six assertions in source
and emitted consumers: the first projection preserves the exact inner object;
the second exposes `Promise<number>` and both ordered metadata frames.

All 35 existing box-adapter negative controls pass in both programs. All 11 extra
adversarial calls reject at their boundaries; one explicit opaque-provider union
has a truncated diagnostic that lacks the additional probe's requested phrase,
so only 10 of those 11 message checks pass. The historical mixed-provider union
erasure remains fixed. This probe uses the structural capability fixture, not a
freshly installed real box; completed real-package integration is separate.
No new val candidate was tried, and the earlier unsafe sketches remain rejected.

## Reproduction and scope

Full local evidence and exact commands:
`/tmp/di-bag-current-inline-inference-advisory.md`.
Pinned scripts: `/tmp/di-bag-current-inference.LXJOUR/fork.cjs` and `val.cjs`;
raw final val result: `val-output.json` in that directory. They use git-show or
git-archive source, not concurrent working-tree edits. The local advisory also
records corrections to the old probe's declaration suffix handling, diagnostic
region parsing, and adapter entrypoints; those were harness defects, not
production type failures.

T2 still requires implementation, package-level verification, larger measurements,
and resolution of both inference cases. Existing cast-free predeclaration
workarounds remain supported; this evidence does not narrow the enterprise goal.
