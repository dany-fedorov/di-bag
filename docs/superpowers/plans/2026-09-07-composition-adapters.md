# Composition adapters implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adapt concrete classes and positional functions with exact token, output and ownership contracts.

**Architecture:** Reuse authenticated provider descriptions and token acquisition;
construct classes with Reflect.construct and call functions with an undefined
receiver. Tuple admission and parameter assignability remain explicit.

**Tech Stack:** TypeScript classic/native, Bun runtime tests, actual Node/Bun packages.

**Spec:** `docs/superpowers/specs/2026-09-07-composition-adapters-design.md`.

## Global constraints

- Preserve existing fromTokens compatibility and all declaration soundness gates.
- No decorators, runtime dependencies, implicit awaiting or automatic ownership.
- No new native diagnostic gap allowances; no change to compiler scale thresholds.
- This is one E1 increment; aliases, optional/lazy references and contributions remain required.

### Task 1: Runtime and checked adapter facade

**Files:** new `src/composition.ts`, `src/di-bag.ts`, `src/index.ts`,
new `tests/composition-adapters.test.ts`, new `tests/types/composition-adapters.ts`,
new `tests/types/composition-adapters-consumer.ts`,
new `tests/types/negative/composition-adapters.ts`, `tests/types.test.ts`.

**Interface:** `DiBag.fromFunction(tokens, callback, options?)` and
`DiBag.fromClass(tokens, constructor, options?)`; options follow existing
`StageOptions<M>` and output `Provider` uses `TokenGraph<T>` and
`Acquired<ReturnType<F> | InstanceType<C>, M>` as appropriate, never a value union
between the two routes. Export helper type aliases through the root if inferred
feature declarations need to name them.

- [x] Write failing runtime/type fixtures. Core example:
  `class Client { constructor(readonly port: number) {} }`;
  `const key = Symbol('port'); const port = DiBag.token(key).of<number>();`
  `const source = DiBag.fromClass([port], Client);`
  `const bag = DiBag.begin().bind(port, () => 8080).add({source}).end();`
  require `bag.resolve('source') instanceof Client` and exact `.port: number`.
- [x] Record RED from the focused tests/type fixtures before implementation.
- [x] Implement the two adapters using existing token snapshot/provider helpers.
  Function arguments retain exact values; use Reflect.apply with undefined this.
  Constructability probe must not invoke the constructor or prototype getter;
  actual acquisition uses Reflect.construct with the original constructor.
- [x] Validate finite genuine tuples and supplied arguments against actual function
  or constructor parameters, including optional/rest parameters. Reject required
  this, missing/incompatible arguments, surplus finite arguments, nonconstructors,
  abstract/private/protected constructors, forged tokens and invalid native mode.
- [x] Cover class prototype/private fields/new.target, thrown setup/retry,
  Promise identity, raw/native ownership, thenable class values, explicit bound
  methods, empty tuples, custom iterators and tuple mutation after declaration.
  Include root/selected-sharing/module graph behavior without changing ownership.
- [x] Run focused runtime and classic/native source checks, self-review, commit
  only implementation/test files and report exact commands/results for review.

### Task 2: Physical package evidence and documented usage

**Files:** `tests/box-contract-fixtures.ts`, `tests/native-package.test.ts`,
`tests/package.test.ts`, new `tests/composition-adapters-runtime-fixture.ts`,
`examples/composition.ts`, `README.md`, `CHANGELOG.md`, migration, program tracker,
new `docs/reports/2026-09-07-composition-adapters.md`.

- [x] Add both new source fixtures to classic/native archive consumers, and add
  inferred producer/consumer emission to physical declaration-only routes.
- [x] Run actual Node/Bun CJS/ESM consumers from both emitter archives; assert
  class identity/private-field behavior, positional token values, raw Promise
  identity, root sharing and exactly-once owned cleanup.
- [x] Document direct class/function usage and arity, receiver and acquisition
  policies. Provide and execute an example using existing classes/functions.
- [x] Run full `npm run check`, native strict typecheck/build, native source audit,
  every example and diff checks. Keep all remaining enterprise rows open.
- [x] Independent task/full-increment review, corrections and verified local commit.
- [ ] Non-force branch push when export approval permits; verify the remote SHA.
  No package publication.

Evidence: `docs/reports/2026-09-07-composition-adapters.md`. Full check passes
586 tests / 3,043 assertions; both compiler archives, native checks and all six
examples pass. Scoped re-review approves both package corrections at `68930c0`.
