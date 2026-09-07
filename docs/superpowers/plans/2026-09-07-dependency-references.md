# Optional and lazy dependency references implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add genuinely optional and lazy token dependencies while preserving module, lifetime and acquisition contracts.

**Architecture:** Authenticated immutable reference handles feed the positional
adapters. Provider descriptions retain internal argument slots mapped to lexical
token lookups; provider graph contracts separate optional and required obligations.

**Tech Stack:** TypeScript classic/native, Bun runtime tests, actual Node/Bun archives.

**Spec:** `docs/superpowers/specs/2026-09-07-dependency-references-design.md`.

## Global constraints

- No implicit awaiting, swallowed acquisition failures, or new resource owners.
- Optional absence differs from a present undefined service and from failure.
- Lazy closure invocation uses the capturing acquisition's graph and admission gate.
- Retain ordinary named-factory behavior and existing fromTokens compatibility.
- Preserve invariant provider/module contracts and every native diagnostic gate.
- Aliases, contributions, observers/plugins, scale and release work remain required.

### Task 1: Reference handles and complete graph/runtime integration

**Files:** new `src/dependency-references.ts`, `src/provider.ts`,
`src/composition.ts`, `src/provider-operations.ts`, `src/acquisition.ts`,
`src/runtime.ts`, `src/token-types.ts`, `src/module-types.ts`, `src/lifetime-types.ts`,
`src/types.ts`, `src/di-bag.ts`, `src/index.ts`; new
`tests/dependency-references.test.ts`, `tests/types/dependency-references.ts`,
`tests/types/dependency-references-consumer.ts`,
`tests/types/negative/dependency-references.ts`, `tests/types.test.ts`.

**Interface:** `DiBag.optional(token)` provides a `Service | undefined` positional
argument; `DiBag.lazy(token)` provides `() => Service`. All three positional
adapters accept these handles alongside ordinary tokens in a finite const tuple.
Required and optional graph obligations remain separately extractable by internal
type helpers; module public views must preserve or transfer both obligations.

- [ ] Write RED fixtures with `const key = Symbol('number');`
  `const number = DiBag.token(key).of<number>();`
  `const optional = DiBag.fromFunction([DiBag.optional(number)], value => value);`
  require `DiBag.begin().add({optional}).end().resolve('optional') === undefined`
  and exact output `number | undefined`. An existing incompatible token rejects.
- [ ] Add RED lazy fixture using `DiBag.fromFunction([DiBag.lazy(number)], get =>
  ({get}))`; assert no target calls on resolving the consumer, then correct calls,
  identity, transient multiplicity and disposal edges on each get invocation.
- [ ] Implement nominal invariant wrappers authenticated by private registry;
  input must be one individually known genuine token. Copy/freeze descriptions;
  neither handle is a binding identity or a structural registration.
- [ ] Generalize tuple argument extraction/admission in fromTokens/fromFunction/
  fromClass. Preserve empty/optional/rest parameter behavior, exact output/acquired
  modes and required receiver rejection. Existing fromTokens callers still work.
- [ ] Add immutable reference records to source descriptions and normalization.
  Map internal argument slots to real lexical keys in acquisition dependency reads.
  Add a binding-existence lookup that can return absent before calling acquisition;
  never implement optional reads as catch-and-undefined. Lazy closures defer the
  same dependency read and its existing source-specific closing check.
- [ ] Separate required/optional token contracts. Update full and incremental
  wrong-shape/nominal checks, missing checks, private module constraints, module
  external requirements and public views/renames. Optional absence permits closure;
  optional presence must retain its type contract even in exportless modules.
  Keep provider unions and NoInfer extraction sound.
- [ ] Include present optional and lazy edges in root-captive static walks and
  preserve observed-edge runtime capture checks. Do not weaken checks after
  selected scope overrides or independent forks.
- [ ] Cover absent/present/undefined/failing/rejected optional services; lazy
  construction timing, cache/transient identity, synchronous/post-await cycles;
  late/ready/retired proxies and closure invocation during/after owner close;
  root/child sharing and overrides; private tokens/export renames and host
  collisions; raw/native Promise ownership; forged/spread/proxied handles,
  tuple mutation/custom iterators, explicit generic and reflected-method views.
- [ ] Run focused runtime and classic/native source/declaration checks, record
  RED/GREEN and self-review. Commit implementation/tests for independent review.

### Task 2: Physical archives, documentation and regression verification

**Files:** `tests/box-contract-fixtures.ts`, `tests/native-package.test.ts`,
`tests/package.test.ts`, new `tests/dependency-references-runtime-fixture.ts`,
`examples/composition.ts`, `README.md`, `CHANGELOG.md`, migration, enterprise tracker,
new `docs/reports/2026-09-07-dependency-references.md`.

- [ ] Add positive/negative files to classic/native packed contract routes and
  inferred feature emission with source physically removed before downstream use.
- [ ] Execute actual Node/Bun CJS/ESM packages from both emitter archives; assert
  absent versus failing optional values, deferred acquisition/transient cleanup,
  parent graph/context ownership after selected sharing, and closed-owner rejection.
- [ ] Document graph optionality separately from an optional function parameter;
  lazy means delayed resolution, not a missing dependency or extended lifetime.
  Provide runnable class/function examples using both reference handles.
- [ ] Run full check, native strict typecheck/build and source diagnostic audit,
  all examples and diff checks, keeping all unresolved program rows explicit.
- [ ] Independent task/final review, findings correction, verified commit and
  non-force branch push when its required approval permits; verify remote SHA.
