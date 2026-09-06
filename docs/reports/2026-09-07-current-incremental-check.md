# Current incremental checker evidence

A signature-only candidate reduces repeated relationship checking on the current
typed-token implementation. It is preliminary T2 evidence, not adopted production
code or completion of the enterprise compiler-performance requirements.

Pin: `b505d660eb4fd27badc5001066fbf199b2ba410b`; TypeScript 5.9.3, Node 24.20.0.
Each case used a fresh approved Node child, a 60-second timeout and a 3,072 MiB
old-space cap. Compiler options match `tests/compiler.ts`. Sources are supplied
from the pinned commit through a virtual compiler host. Actual unchanged source
generators produce individual named adds and token binds, without replacing them
with batches, ambient graph aliases or widened registration types.

## Candidate and diagnostic correction

Current builder add/bind/replace signatures repeatedly check the entire merged
registration graph. Accepted existing relationships can instead be retained:
check the incoming registrations, new consumers against surviving providers, and
surviving consumers against new/replaced providers. Named and invariant token
relationships both participate. The candidate appends these types to `types.ts`,
with `ProviderTokenNeeds` and `WrongToken` imported from their existing modules:

```ts
type NewWrong<E extends Entry, N extends Registrations> = {
  [K in keyof N]: Pick<Provided<From<E>>, Exclude<keyof Needs<N[K]>, keyof N> & E['key']> extends
    Pick<Needs<N[K]>, Exclude<keyof Needs<N[K]>, keyof N> & E['key']> ? never : K
}[keyof N];
type OldWrong<E extends Entry, N extends Registrations> = E extends Entry
  ? E['key'] extends keyof N ? never
    : Pick<Provided<N>, keyof Needs<E['registration']> & keyof N> extends
      Pick<Needs<E['registration']>, keyof Needs<E['registration']> & keyof N> ? never : E['key']
  : never;
type NewTokenWrong<E extends Entry, N extends Registrations> = {
  [K in keyof N]: WrongToken<ProviderTokenNeeds<N[K]>, From<Exclude<E, { key: keyof N }>>>
}[keyof N];
type OldTokenWrong<E extends Entry, N extends Registrations> = E extends Entry
  ? E['key'] extends keyof N ? never : WrongToken<ProviderTokenNeeds<E['registration']>, N>
  : never;
export type IncrementalChecked<E extends Entry, N extends Registrations> = unknown extends Checked<N>
  ? [NewTokenWrong<E, N> | OldTokenWrong<E, N>] extends [never]
    ? [NewWrong<E, N> | OldWrong<E, N>] extends [never] ? unknown
      : Unsatisfied<'a dependency has the wrong shape', { tokens: NewWrong<E, N> | OldWrong<E, N> }>
    : Unsatisfied<'token dependency has an incompatible or opaque contract', { tokens: NewTokenWrong<E, N> | OldTokenWrong<E, N> }>
  : Checked<N>;
```

Five builder signature operands become `IncrementalChecked<E, N>` or its exact
singleton registration equivalent: add, two named replace overloads, bind and
token replace. Flat Entry history, admission, output types, preliminary replacement
context, C constraints, final closure, module builder/install and bag fork remain
unchanged. An overwritten bound token is excluded from the new consumer's surviving
provider map; its replacement contract is checked within the incoming map.

The first candidate intersected three branded diagnostic objects. Opaque G still
rejected, but conflicting `tokens` details collapsed its explanation to
`not assignable to never`: only 16 of 17 focused message checks passed. One
refinement, shown above, preserves the incoming `Checked<N>` error first, then
selects token and named cross-check errors in sequence. All 17 focused boundaries
retain their intended messages after that correction. No validation relationship
was removed. Exact prioritization for every simultaneous multi-error program is
not yet proved and requires review during implementation.

## Measurements

Single observations on a shared machine, not statistical latency or portable
memory guarantees. Baseline and refined measurements are separate fresh children.

| Actual source | Baseline compiler ms / MiB RSS | Refined compiler ms / MiB RSS | Refined instantiations |
| --- | ---: | ---: | ---: |
| 100 named adds, valid | 2,103 / 379 | 1,192 / 439 | 838,819 |
| 100 token binds, valid | 4,120 / 429 | 1,530 / 397 | 1,361,316 |
| 500 named adds, valid | Not rerun at this pin | 11,953 / 1,752 | 17,596,619 |

The 100-case checker times decrease approximately 43% and 63%; instantiations
decrease approximately 78% and 87%. Memory does not uniformly improve. The 500
result is actual completion of the original fluent named-add fixture, not a
substituted grouped or non-generic control. Its 1,752 MiB RSS remains substantial.

The refined 100-case negatives also retain the intended diagnostic and boundary:

| Case | Compiler ms / MiB RSS | Intended diagnostic |
| --- | ---: | --- |
| Named missing dependency | 1,118 / 363 | TS2684, line 3, missing factories |
| Named wrong dependency shape | 1,193 / 440 | TS2345, line 53, wrong shape |
| Token missing dependency | 1,612 / 479 | TS2684, line 204, missing factories |
| Token invariant mismatch | 1,838 / 543 | TS2345, line 303, incompatible/opaque contract |

Focused positives preserve richer named/token outputs, forward requirements,
replacement and module-private named/token obligations. Focused negatives check
both relationship directions, replacement, incoming named/token needs, output
admission, opaque G/bound handles and retained C requirements. All 17 match
baseline codes and lines; no extra diagnostics occur. All refined children exit
normally with visible output, no stderr, timeout, compiler crash or TS2589.

The controller independently read the complete probe and reran the refined
17-negative fixture and 100-token valid case: all intended boundaries pass; the
valid case has zero diagnostics and the same 1,361,316 instantiations. Its separate
measurement was 1,851 ms / 542 MiB RSS, illustrating why a single memory or timing
observation is not a portable budget. Controller negative run: 748 ms / 322 MiB.

## Reproduction and remaining work

Full local advisory, including the failed first candidate and exact outputs:
`/tmp/di-bag-current-incremental-check-advisory.md`.
Probe: `/tmp/di-bag-current-incremental-PtQ9Vk/probe.mjs`.

```sh
node /tmp/di-bag-current-incremental-PtQ9Vk/probe.mjs run refined 0 focused negative
node /tmp/di-bag-current-incremental-PtQ9Vk/probe.mjs run refined 100 bindings valid
node /tmp/di-bag-current-incremental-PtQ9Vk/probe.mjs run refined 500 chained valid
```

The advisory lists every paired command and saved output. No 500 negative, 500
token/module, 1,000-library-call, full-suite, emitted or installed-consumer run was
performed for this candidate. Large C constraints remain whole-map checks. Broad
inference/heterogeneous unions and simultaneous-error prioritization still need
production integration and review. The separate non-generic 1,000-fluent TypeScript
binder-stack reproduction remains an external syntax-depth control, not evidence
that 1,000 real di-bag operations pass. Original failed forms must remain visible
in future measurements; any alternate syntax or compiler configuration must be
explicitly reported rather than silently replacing a gate.

Next: implement and verify the incremental checks under a dedicated T2 plan,
alongside the required larger measurements and the two independently reproduced
[inline inference cases](2026-09-07-current-inline-inference.md). This report does
not complete or narrow the larger enterprise program.
