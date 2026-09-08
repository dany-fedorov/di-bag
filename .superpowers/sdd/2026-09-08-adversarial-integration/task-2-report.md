# Task 2: adversarial type and declaration matrix

Base SHA: `fe21f07`

The structural RED registered the I14 source and declaration consumers before
their fixtures existed. `bun test tests/types.test.ts` reported exactly two
failures: the missing consumer source and the missing producer needed for
declaration emission. No production source changed.

The positive fixture combines one token dependency with a positional class
adapter, validated plugin provider, composed SasBox/ValBox adapters, named
alias, module exports, and a selected child override that shares a disjoint
boxed service. Both producer and consumer assert exact values, acquired plugin
output, token needs, adapter frames, module exports, alias output, and selected
scope output through public type carriers without casts.

The negative fixture has two regions. The first rejects sharing and overriding
`boxed`; the second shares only `boxed` while overriding `plugin` with an
incompatible factory. This prevents either compiler diagnostic from satisfying
both markers.

The declaration checks cover three distinct boundaries:

- an in-memory `.d.ts` whose producer source is hidden from the consumer host;
- installed CommonJS and ESM archive declarations for both positive and
  negative fixtures;
- physical `.d.cts` and `.d.mts` output from both classic6 and native7 emitters,
  followed by deletion of the whole producer source directory and downstream
  compilation by both compiler implementations.

Fresh verification:

- focused I14 source/declaration/negative checks: 3 pass, 11 assertions;
- complete classic type and marker suite: 123 pass, 466 assertions;
- classic strict typecheck: exit 0;
- installed archive box/declaration matrix: 117 pass, 323 assertions;
- physical classic/native package matrix: 2 pass, 1,208 assertions;
- native strict typecheck: exit 0;
- native diagnostic audit: 124 fixtures, 662 expectations, 635 matches, the
  reviewed 27 gap declarations, 0 unexpected diagnostics, and 0 failures.

Task 1's I12 runtime RED remains unchanged and was not included in these
compiler-only gates.
