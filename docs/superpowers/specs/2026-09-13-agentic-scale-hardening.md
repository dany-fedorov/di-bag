# Agentic-scale hardening

Decisions from the 2026-09-13 assessment of what limits codebases built on
DI Bag when autonomous agents develop them. Each decision below has one
implementation plan in `docs/superpowers/plans/`.

## Why

An agent works through a loop: read a small part of the codebase, edit, run the
type checker and tests, read the diagnostics, repeat. Six properties of the
current library make that loop slow, misleading, or impossible at scale:

| # | Finding | Evidence (measured 2026-09-13, classic TypeScript 6.0.3) |
| --- | --- | --- |
| 1 | Module declarations leak every private registration type. | A module exporting one service emitted a `.d.ts` containing all three private factories twice, including a private type name. Lifetime obligations (`LexicalContext<R, ...>`) and `ModulePublicProviders<R, ...>` retain the full registrations map. |
| 2 | No static dependency graph exists at runtime, and there is no way to list a bag's bindings. | Dependencies are discovered by Proxy reads while a factory runs. A two-service cycle compiles clean and fails only at resolve time. |
| 3 | Compiler diagnostics hide the actionable part. | A missing dependency reports a `this`-context error anchored at `DiBag.createBuilder()`; the missing key appears only with `noErrorTruncation`. |
| 5 | The dependency object silently misbehaves under `in`, `Object.keys`, and spread. | `'logger' in deps` is `false`, `Object.keys(deps)` is `[]`, `{ ...deps }` is `{}`. |
| 6 | Structural thenables (query builders) fail only at first resolve. | A Knex-style builder returned from a plain factory throws `DI_BAG_STRUCTURAL_THENABLE` at runtime; nothing warns at compile time. |
| 8 | The library's own test loop is 8.5 minutes. | `bun test tests`: 967 tests, 511 s. `types.test.ts` alone 88 s; each negative fixture builds a fresh compiler program. |

Items 4 (bounded transient history) and 9 (unwrapped view of started services)
are explained separately and are not planned yet. Item 7 (agent-facing docs
and discoverability) is deferred to a separate session; its agenda is
`2026-09-13-agent-discoverability-brief.md` in this directory.

## Decisions and names

### D1. Erase private registrations from `Module` types (plan 07)

- String-keyed exports flatten to a resolved object type; symbol-keyed exports
  become `Record<typeof key, Service>` intersections. Declaration emit cannot
  serialize an expanded mapped type whose key is a `unique symbol` (verified:
  "The type of this node cannot be serialized because its property '[handlerKey]'
  cannot be serialized"), so symbol keys must stay alias references.
- Lifetime checking moves from host-build-time lexical walks over the module's
  full registrations to seal-time reachability: a sealed module retains only
  which export or external keys each strict root and each exported carrier
  (transient or alias) reaches. Private-only captives fail at `buildModule`.
- `LexicalContext`, `ModuleScope`, `Enclosed`, `RenamedContext`,
  `EnclosedLifetimeObligation`, `RenamedLifetimeObligation`, and
  `RenamedLifetimeProviders` are removed from the public type exports.
- Acceptance: a consumer `.d.ts` for a module contains none of the module's
  private names, the existing module, nested-module, lifetime, contribution,
  and declaration-consumption fixtures pass, and the 1,000-provider named-module
  scale case stays accepted.

### D2. Graph inspection and extraction (plans 05 and 06)

- Runtime: `bag.inspectGraph()` returns a frozen `GraphSnapshot` listing every
  binding (public keys, label, lifetime, acquisition mode, ownership, typed-token
  dependencies, metadata, acquisition attempts), contribution groups, and the
  dependency edges observed during acquisition so far. It acquires nothing.
  Named dependencies are not knowable at runtime and are documented as such.
- Static: a standalone tool package `di-bag-graph` in `tools/graph` uses the
  TypeScript checker to extract declared named dependencies per registration,
  builder chains, module exports and installations, lifetimes, and async outputs
  into JSON, and reports cycles and unresolved names. It is a separate package
  because the release contract requires DI Bag to have no peer dependencies
  (`scripts/verify-release-artifacts.ts` line 120).

### D3. Legible diagnostics and `verifyGraph()` (plan 03)

- The `Unsatisfied<Message, Details>` shape does not change. Two alternatives
  were prototyped and rejected: a mapped type keyed by the message hides the
  message behind named aliases such as `InvalidRename`, breaks a type-identity
  assertion in `tests/types/incremental.ts`, and triggers TS2589 at 1,000 grouped
  providers; a single tuple-valued property has the same alias problem.
- Message strings carry the names: `required service registrations are missing: clock`,
  `provided service does not satisfy its consumer dependency: db needs config`,
  `root lifetime cannot capture scoped dependency: db -> config`,
  `fork accepts existing names or typed tokens only: unknown extra`. The
  per-`register` incremental site names only the consumers (`check db`), because
  expanding relationships there produced TS2590 at 1,000 grouped providers.
  Verified: all 77 negative fixtures, the type-scale suite, and `tests/types.test.ts`
  pass with these messages.
- Deviation after merge (measured 2026-09-13): named messages at the per-call
  wrong-shape sites (`CheckDependencyCompatibility`, `IncrementalChecked`,
  `CheckedConstraints`) pushed `tests/incremental-scale.test.ts` over its pinned
  instantiation ceilings, because TypeScript expands both branches while inferring
  `register` arguments. Even a consumer-only template stayed over two ceilings
  (100 named additions 800,280 > 790,000; 100 token modules 1,245,081 > 1,220,000).
  Those three sites keep the plain message; `verifyGraph()` reports their details.
  Names stay in missing-service, module-completeness, lifetime, and key-selection
  messages. With plain wrong-shape messages and a generic `this` on `verifyGraph`:
  765,037 / 824,964 / 1,215,945 against ceilings 790,000 / 850,000 / 1,220,000.
- `builder.verifyGraph()` is a runtime no-op typed as `CompositionReport<typeof builder>`:
  `void` when the graph would build, otherwise the same failure `build()` would
  report, with details. Usage: `builder.verifyGraph() satisfies void;`. The error
  anchors at that call and prints the full report on one line.
- The tutorial gains a section on reading compile-time rejections, including
  `noErrorTruncation`.

### D4. Fail loudly on dependency-object enumeration (plan 02)

- The dependency Proxy gains `has`, `ownKeys`, and `getOwnPropertyDescriptor`
  traps that throw `DI_BAG_INVALID_DEPENDENCY_ACCESS` naming the consumer.
  Destructuring and direct property reads are unaffected (only `get` is used).

### D5. Compile-time structural-thenable check with a switch (plan 04)

- Plain factories, disposable factories, and `auto`-mode `fromFactory`,
  `fromFunction`, and `fromClass` reject outputs that have a callable `then` but
  are not `Promise`, with the message
  `factory output is a structural thenable: users; return a native Promise or use DiBag.fromFactory with acquisitionMode raw or nativePromise`.
  `any` outputs are exempt.
- Local opt-out: an explicit `acquisitionMode`. Global opt-out:
  `declare module 'di-bag' { interface DiBagPolicy { readonly structuralThenables: 'allow' } }`.
  Verified on a scratch copy: the augmentation works through `di-bag` and
  `di-bag/node` once `DiBagPolicy` is exported from `src/index.ts`.

### D6. Test lanes and a shared compiler program (plan 01)

- `npm run test:fast` runs runtime tests; `npm run test:compiler` runs the
  compiler, package, native, platform, and benchmark suites; `npm test` runs both.
- `tests/compiler.ts` caches parsed source files, reuses the previous program,
  and compiles all negative fixtures in one program. Measured on 12 fixtures:
  fresh programs 8.9 s, one shared program 0.8 s.

## Sequencing

1. Plan 01 (test lanes) first: it speeds up every later plan's verification.
2. Plan 02 (proxy guards): small and independent.
3. Plan 03 (diagnostics): defines `NameText`, which plan 04 reuses.
4. Plan 04 (thenable check).
5. Plan 05 (runtime graph inspection).
6. Plan 06 (static extraction tool).
7. Plan 07 (module declaration erasure): largest and riskiest; last.

## Global constraints

- Minimum supported TypeScript is 6.0.3; native 7.0.2 checks must keep passing (`npm run check:native`).
- The published package keeps zero runtime, peer, optional, and bundled dependencies.
- `tsconfig.json` is `strict` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- `npm run check` (typecheck, tests, build) must pass before every commit.
- After changing public API comments or exports: `npm run docs:generate`, then `npm run docs:check` (requires `npm ci --prefix tools/docs`).
- Pending changelog entries went into `docs/superpowers/release-notes-draft.md` until the 0.2.0 release moved them into `CHANGELOG.md`: the release contract forbids an `## Unreleased` section and requires the top section to be the frozen package version. The API is pre-1.0 and compatibility aliases are not kept.
- Code style: single quotes, semicolons, two-space indentation, terse comments explaining why.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
