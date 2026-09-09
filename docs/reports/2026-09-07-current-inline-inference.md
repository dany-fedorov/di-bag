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

### Follow-up: conditional-arity validation (rejected)

A separate probe pinned to `33f8a8e0500218e34c5c1996c870ae1966932126` reproduced
the same baseline before testing one new hypothesis: move validation off the
contextual first argument into a conditional rest tuple on a plain-factory
overload. It checked the actual inferred factory through `ProviderOutput<F>`,
without an independently selectable output type or a contextual `any`:

```ts
export function fromValBox<F extends (this: void, deps: never) => unknown>(
  registration: F & ((this: void, deps: never) => unknown),
  ...validation: unknown extends Valid<ProviderOutput<NoInfer<F>>>
    ? [] : [error: never]
): Adapted<F, ProviderOutput<F>, 'required'>;
```

This does **not** solve the inference ordering problem. Inline adaptation still
fails with TS2345, the second adaptation now also fails, and five exact assertions
fail in both source and emitted consumers. Error recovery selects the generic
factory constraint, not the actual nested return. Both programs retain the 35
existing negative controls and rejection at all 11 additional adversarial call
boundaries. The emitted receiver-control diagnostic also loses the requested
capability phrase, although the call remains rejected.

Both baseline and candidate children exited normally with visible JSON using
TypeScript 5.9.3, a 10-second timeout and a 512 MiB old-space cap. Script:
`/tmp/di-bag-val-arity-probe.cjs`; raw candidate result:
`/tmp/di-bag-val-arity-output.json`. Reproduce with `set -o pipefail` and:

```sh
git archive 33f8a8e0500218e34c5c1996c870ae1966932126 \
  src tests/types/box-adapters.ts tests/types/negative/box-adapters.ts \
  tests/types/assert.ts | timeout 10s node --max-old-space-size=512 \
  /tmp/di-bag-val-arity-probe.cjs arity_gate
```

Run `baseline` instead of `arity_gate` for the unchanged control.
This was a virtual source edit only; no overload is adopted. Conditional arity
is not a reliable substitute for an inference boundary here. Further work needs
a deliberate inference/validation architecture review, not another variation of
the rejected capture, contextual-any or arity sketches.

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
