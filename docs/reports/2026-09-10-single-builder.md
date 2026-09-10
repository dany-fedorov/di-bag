# Single builder: design, assumptions, and evidence

`ModuleBuilder` and `BagBuilder` were near-duplicate classes. Both offered
`register`, `replace`, `alias`, and `contribute` with the same semantics; they
differed only in their exits (`build`/`buildAndStart`/`installModule` versus
`buildModule`) and in their storage. This change keeps the bag/module split, which
is real (a bag owns resources and must be complete; a module is a sealed
declaration with open requirements), and removes the builder split, which was not.

## What changed

- One `Builder` class in `src/di-bag.ts` carries every operation. `build()` still
  requires completeness; `buildModule(keys)` seals the same graph and projects
  the gaps as requirements. `DiBag.createModuleBuilder()` is removed.
- `Module` in `src/module.ts` now holds a `GraphDescription` snapshot taken by the
  new `BindingGraph.describe()` plus an export map. Installation re-mints every
  binding identity in the snapshot, at every nesting depth.
- Because a builder that installed modules can now seal, modules nest. Lexical
  scoping became a chain: `LexicalContext.parent` at the type level and merged
  `localNames` maps at runtime.

## Assumptions made without asking

1. **Naming.** The merged class is `Builder`, not `BagBuilder`. A builder that
   seals modules is misnamed as a bag builder, and `createBuilder()` never said
   "bag". `CONTEXT.md` gains a Builder term.
2. **Invariance wins.** `BagBuilder` kept an invariant entry witness, so a
   reflected `ReturnType<typeof builder.replace>` view was not assignable from the
   concrete builder. `ModuleBuilder` had a registration-map witness that allowed
   that assignment. The merged builder keeps the stricter witness. Two positive
   fixtures that relied on the lenient behavior now call `buildModule` on the
   concrete builder; two negative fixtures now expect the rejection for module
   graphs too.
3. **Incremental checks for module graphs.** `ModuleBuilder.register` rescanned the
   full graph with `CheckDependencyCompatibility`; `BagBuilder` checked only the
   relationships crossing into new entries. The merged builder uses the incremental
   check everywhere. Accepted and rejected graphs are the same; the negative
   module fixtures still match every marker.
4. **Snapshot order.** `describe()` emits public bindings in first-declaration
   order by key, then contribution bindings in group order, then any privately
   retained binding. A first attempt also kept a creation-order sequence of
   binding IDs; the graph-retention suite caught it retaining replaced IDs, so
   only the public key order is stored. Keys are never unregistered, so that
   sequence retains nothing the graph would otherwise release.
5. **Dropped constraints are final.** When an enclosing module satisfies an inner
   requirement with a private registration, the constraint is dropped at seal time.
   The satisfying registration was already checked against the need when it was
   registered, and the host cannot replace a private binding.
6. **Constraints on exports survive.** When the enclosing module satisfies an inner
   requirement with an exported registration, the constraint becomes an `export`
   constraint of the outer module, so a host `replace` of that export stays
   checked. Renaming follows the export.
7. **Lexical providers are re-pointed, not stacked.** An exported provider that
   already carries a lexical source is re-pointed at the sealing scope's own entry;
   the walk unwraps inner sources by enclosing their context in the scope where
   they were found. Retained obligations and contributions are enclosed at seal
   time instead. This keeps one rule for both without double-enclosing.
8. **Label text is unchanged.** Private bindings keep their local key as label at
   every depth; no module path is added to labels or diagnostics.

## Edge cases covered by tests

Runtime, in `tests/nested-modules.test.ts`:

- One builder value yields a bag and a module; later builder operations do not
  affect the sealed module.
- Repeated installation of a nested module isolates inner private instances and
  disposes dependents first at every depth, including through `fork`.
- Names resolve inner scope, then enclosing module, then host, including a name
  the host also registers.
- Host `replace`, `fork` overrides, and `createScope` overrides of an outer export
  reach inner consumers.
- Renaming a nested export at the outer level after an inner rename.
- Contributions from host, outer, and inner install in declaration order and
  resolve their own private dependencies.
- Aliases through nesting with exported and private targets.
- Three levels forward an unmet requirement outward; a replaced registration
  before sealing stays private.
- An export-less outer module still installs nested contributions.
- `buildAndStart` and shared child scopes acquire nested exports.
- Sealing rejects unknown keys, non-tuples, forged modules, and duplicates.

Types, in `tests/types/nested-modules.ts` and `tests/types/negative/nested-modules.ts`:

- `ModuleRequiredServices` of a nested module contains exactly the forwarded
  requirements, for names and typed tokens, through three levels.
- A host may reuse a private nested name with an unrelated type.
- A requirement satisfied by an enclosing export stays checked on host `replace`,
  including after `renameExport`.
- Root lifetimes inside nested modules are accepted when every dependency is a
  root, and rejected when they capture a scoped dependency that is private to
  the enclosing module, exported and renamed by it, reached through nested
  transient bridges from the host, or contributed from a nested module.

## Verification

Run on this branch on 2026-09-10 with the pinned toolchain (Node 24.20.0,
npm 11.19.0, Bun 1.4.2, TypeScript 6.0.2 and native 7.0.2):

| Command | Result |
| --- | --- |
| `npm run typecheck` | 0 errors across src, tests, and examples |
| `npm test` | 967 tests, 0 failures, with `npm_config_update_notifier=false`. An earlier run failed only in `tests/package.test.ts`, which rejects any npm stderr output and saw an npm update notice unrelated to this change. |
| `npm run build`, `npm run build:native` | both emit |
| `npm run typecheck:native`, `npm run check:native` | 0 errors; 128 fixtures, 669 of 669 expected diagnostics matched, 0 unexpected |
| `npm run docs:check` | generated reference current, 12 rendering tests pass |
| `node --expose-gc --test tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs` | 31 pass, 0 fail against the rebuilt `dist` |

Compiler cost was not re-measured against the recorded benchmarks. The
`buildModule` return type does strictly more work than before because it
re-scopes retained constraints; the existing 20-module scale fixture still
passes within the suite.
