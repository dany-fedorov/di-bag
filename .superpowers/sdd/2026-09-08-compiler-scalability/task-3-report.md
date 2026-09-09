# Task 3: incremental installation constraints

Source checkpoint: `94e81a23fb1f0f635a708c20990839172434299e`.
Candidate source hash: `90d656f628878dd926da736db2ce4781f9763e9d5fdc0f6834ae0128f475c198`.

## Decision

Adopt the bounded installation change. Root installation now uses the existing
`IncrementalChecked` relationship checker for incoming registrations and a new
`IncrementalConstraints` helper for plain named/token constraints. The helper
retains the previous whole-graph `CheckedConstraints` path whenever the retained
or incoming constraint union contains a contribution, `all`, opaque, or lifetime
member. The runtime body, `Builder<E | Entries<D>, C | MC>` result, invariant
state, closure checks, lifetime checks, and completion checks are unchanged.

This resolves the original 500 individual-module ceiling on both compiler lanes.
It does not resolve the 1000-call ceiling, which remains open rather than being
relabelled as accepted.

## TDD and mutation evidence

- Interface RED: the new positive fixture failed because `IncrementalConstraints`
  was not exported; its dependent exact-type assertion failed with it.
- Performance RED: classic 500 modules/valid timed out after 60,197 ms on the
  unchanged source, with no worker result.
- Semantic GREEN: private forward needs pass in both install orders, exact output
  stays `number`, required tokens can be bound after installation, and optional
  token needs accept both absence and compatible presence.
- Negative GREEN: private forward mismatches in both orders, missing factories,
  and an incompatible present optional/required token contract retain their
  required diagnostics.
- Fallback mutation RED: replacing the fallback-category extraction with `never`
  made `negative/contributions.ts` lose its required incompatible-contract
  diagnostic. Restoring the full fallback returned the corpus to GREEN.

## Verification

- Focused new fixture gate: 2 tests, 6 assertions, 0 failures.
- Retained module/incremental/contribution/lifetime/alias/replacement slice:
  33 tests, 121 assertions, 0 failures.
- Complete classic type-contract suite: 109 tests, 429 assertions, 0 failures.
- Compiler-work and scale suites: 23 tests, 101 assertions, 0 failures. Existing
  100-case work remains 883,806 named and 1,461,065 token instantiations.
- Native diagnostic audit: 117 fixtures, 657 expected diagnostics, 630 matched,
  the same 27 declared gaps, 0 unexpected diagnostics, and 0 failures. Both new
  fixtures pass; all five new negative markers match.
- Classic and native full-project typechecks and declaration builds exit 0.

## Original selected cases

All rows used the original generated expression, 60-second process limit,
3,072 MiB memory bound, default stack, and provenance checks.

| Lane | Case | Outcome |
| --- | --- | --- |
| classic | 500 modules valid | accepted; 26.7-27.1 s; 41,313,485 instantiations; about 2.16 GiB max RSS (2,209 MiB) |
| classic | 500 modules missing-final-token | accepted at line 1504; 26.9 s; 41,297,549 instantiations |
| classic | 500 modules mismatched-invariant-service | accepted at line 2003; 27.4 s; 41,310,048 instantiations |
| native | 500 modules valid | accepted; 14.68 s; 41,297,853 instantiations; 1,094.9 MiB sampled RSS |
| native | 500 modules missing-final-token | accepted at line 1504; 14.70 s; 41,281,905 instantiations |
| native | 500 modules mismatched-invariant-service | accepted at line 2003; 14.69 s; 41,294,417 instantiations |
| classic | 1000 modules valid | timed out after 60.177 s |
| classic | 1000 bindings valid | timed out after 60.275 s |
| native | 1000 modules valid | killed at 3,072.09 MiB sampled RSS after 56.99 s |
| native | 1000 bindings valid | TS2589 at original line 2002:15 after 34.24 s and 106,149,379 instantiations |

Raw selected rows remain in `/tmp/di-bag-task3-selected-500.jsonl`,
`/tmp/di-bag-task3-selected-500-negative.jsonl`, and
`/tmp/di-bag-task3-selected-1000.jsonl` for this execution session.

## Remaining-depth decision

The 1000-module scratch variants before `end`, after `end`, and after `resolve`
each exceeded a separate 65-second classic bound. The canonical independent
control `/tmp/di-bag-chain-syntax-control.cjs` gives a non-generic interface the
same 1000-call expression shape and crashes the classic TypeScript binder with
`RangeError: Maximum call stack size exceeded`. This proves a syntax-depth
component that a DI state optimization cannot remove while the original source
form remains fixed. Native TypeScript accepts that syntax depth but the original
generic module expression crosses the memory ceiling, so compiler migration
alone is also insufficient.

Further 1000-call work therefore needs two separately proved prerequisites: a
verified compiler version that handles the required same-expression source form,
and a sealed index state that reduces generic reconstruction work on the native
lane. Any index design must specify its invariant carrier and prove explicit
generic and `ReturnType` views cannot manufacture mismatched state before source
implementation. This task adds no cache generic and makes no 1000-call claim.
