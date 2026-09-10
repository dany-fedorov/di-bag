# di-bag v14 — findings and plan (2026-09-06)

> Historical findings. The v14 source is preserved in [docs/history/src/v14](docs/history/src/v14).
> Use the [README](README.md) for the current API or the
> [history index](docs/history/README.md) to explore earlier designs.

## Intention

di-bag is the composition root for **service factories**. Its first consumer is
`wbs-tool-v1`'s ports-and-adapters split
(`docs/2026-09-05-ports-and-adapters-plan.md`, Wave 3), where
`composeServices({ source, runtime, shared })` builds one graph of ~16 ports, ~20
stores and ~25 services, and `servicesOver(scope.stores, shared)` rebuilds the
service half over a batch's scoped stores. A bag replaces those two hand-written
functions with one graph and a `fork`.

What it must give, in order of value:

1. **Totality at compile time.** A service whose dependency nobody provides is a
   `tsc` error at the composition root, not `undefined` at first request.
2. **Requirements inferred from usage.** A factory states its needs as its
   parameter type; nothing is declared twice. This is the one Effect property
   (`Effect<A, E, R>`'s `R`) worth having without generators or the rest of the
   Effect runtime.
3. **One graph, forkable.** A batch scope or a test replaces some tokens and the
   rest of the graph follows, with a fresh memo.

Explicit non-goals: typed error channels, fiber-local context, schedules. Those
are Effect's; di-bag is not a substitute for Effect and is not on the wbs plan's
critical path. wbs adopts it at Wave 3 only if it has shipped standalone first.

## Findings on v13 (2026-09-06)

Measured, not read off the file:

- `src/pattrern-next-version-v13.ts` alone typechecks **clean** on TypeScript
  5.9.3 (`--strict`, `skipLibCheck`). The types survived three years.
- The repo as a whole does not: `index2.ts`, `index4.ts`, `index5.ts` carry 14
  syntax errors, and `@tsconfig/strictest` v1 sets `importsNotUsedAsValues`,
  removed in TS 5.5+.
- There is **no runtime**. `DiBag.begin()` returns `null as any`; every builder
  method is `null as any`. The file's last TODO is "Start adding runtime ; // !!!".
- Three design problems, in order of weight:
  1. Deps are **declared, not inferred**: `deps.inThisBag({ b: ['a'] })` proves a
     factory for `a` exists, not that `b` uses only `a`. `args.values` exposes
     every token to every factory.
  2. No cycle detection anywhere.
  3. Two `@ts-ignore` inside type parameters ("It actually works, but TypeScript
     does not know about it").

All three are fixable. `src/v14/` is the proof.

## v14 design (proved in `src/v14/di-bag.ts`)

```ts
const bag = DiBag.begin()
  .add({
    clock: () => ({ now: (): number => 42 }),
    digest: () => ({ sha256: (s: string) => `sha:${s}` }),
  })
  .add({
    steps: ({ clock }: { clock: { now: () => number } }) => ({ stamp: () => clock.now() }),
    savedPlan: ({ digest, steps }: { digest: Digest; steps: Steps }) =>
      digest.sha256(String(steps.stamp())),
  })
  .end();

bag.resolve('savedPlan'); // string, inferred
bag.fork({ clock: () => ({ now: () => 7 }) }).resolve('steps').stamp(); // 7
```

Mechanics:

- **Factory constraint is `(deps: never) => unknown`.** `never` is the bottom of
  the parameter position, so every function is assignable to it, and the real
  parameter type comes back through `Parameters<>`. No `any`, no `@ts-ignore`.
- **`Needs<F>`** is the factory's parameter type; **`RequiredOf<Bag>`** is the
  union of their keys; **`Provided<Bag>`** maps each token to its return type.
- **`Checked<Bag>`** judges shape at every `.add`, but only for tokens already
  present, so `.add` order does not matter. A token with the wrong shape fails at
  the `.add` that introduces the mismatch.
- **`EndOf<Bag>`** is `() => Bag` when `RequiredOf ⊆ keyof Bag`, otherwise a
  branded `Unsatisfied<'missing factories', { missing }>` type, so `.end()` is
  not callable.
- **Runtime**: lazy resolution through a `Proxy` over the parameter, memoized per
  bag, a resolving stack that throws `cycle: a -> b -> a`, `fork(overrides)`
  with a fresh memo.

## Evidence (2026-09-06, TypeScript 5.9.3, Bun)

| Check | Command | Observed |
| --- | --- | --- |
| Positive typechecks | `tsc -p src/v14/tsconfig.json` | exit 0 |
| Positive runs | `bun run src/v14/positive.ts` | `{"saved":"sha:42","stamp":42,"fromFork":7,"sameMemo":true}` then `cycle: a -> b -> a` |
| Missing token is a compile error | `tsc -p src/v14/tsconfig.negative-missing.json` | `negative-missing.ts(8,4): Type 'Unsatisfied<"missing factories", { missing: "clock"; }>' has no call signatures.` exit 2 |
| Wrong shape is a compile error | `tsc -p src/v14/tsconfig.negative-wrong-type.json` | `negative-wrong-type.ts(7,5): ... not assignable to '{ readonly [brand]: "a dependency has the wrong shape"; }'` exit 2 |

Both negatives were watched failing before the positive was believed. A check
whose failure has not been observed is a claim, not a gate.

## Plan to v0.1 (~2 days)

1. **Async factories.** `Awaited<>` in `Provided`, `resolve` returns a promise
   when any factory on the path does; sync stays sync. Negative: a sync
   `resolve` of a token whose dependency is async is a compile error.
2. **Disposal.** Optional `dispose` per factory, run in reverse resolution order
   by `bag.close()`. Negative: a disposer that throws still lets the rest run,
   then rethrows the first.
3. **`.end()` as a method** whose return type carries the `Unsatisfied` error, so
   the message names the missing tokens instead of "not callable because it is a
   get accessor".
4. **Test suite**: one file per negative in the table above, plus a `fork` that
   overrides a token with the wrong shape (must fail at `fork`), plus a diamond
   dependency resolved once (memo).
5. **Repo hygiene**: delete `src/index*.ts` and `src/pattern-*`, keep v13 as
   `docs/history/`, replace `@tsconfig/strictest` v1, drop `val-box`/`sas-box`
   (a factory returns a value; metadata boxes are a plugin later if ever),
   `bun test`, publish `di-bag@0.1.0`.

## Open questions

- Should `fork` accept new tokens, or only overrides? Overrides only keeps
  `Bag<F>` stable; new tokens need `Bag<Merge<F, O>>` and a re-check.
- Does wbs want tokens as strings or as `unique symbol` tags to survive renames?
  Strings for now; the type system already catches a rename at `.add`.
- Where does the ring rule put it? `ring:domain`, `runtime:isomorphic`: no
  imports, no globals, one `Proxy`.
