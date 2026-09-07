# Selected scopes implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete selected sharing and checked child overrides without moving ownership.

**Architecture:** The public bag snapshots and validates selections. Runtime and
acquisition owners route immutable binding identities through tracked parents.

**Tech Stack:** TypeScript 6 classic/7 native, Bun tests, Node/Bun package consumers.

**Spec:** `docs/superpowers/specs/2026-09-07-selected-scopes-design.md`.

## Global constraints

- Preserve exact ordinary values, Promise identity and explicit ownership stages.
- Keep forks independent and all existing compiler soundness gates intact.
- No new dependencies and no new native diagnostic gap allowances.
- Test first; review implementation, verify physical archives, then push the branch.

### Task 1: Route shared and overridden binding owners

**Files:** `src/runtime.ts`, `src/acquisition.ts`, new `tests/selected-scope-runtime.test.ts`.
**Interface:** `BindingGraph.hasBinding(id: BindingId): boolean`;
`Runtime.scope(graph?: BindingGraph, shared?: readonly BindingId[]): Runtime`.
The default graph is the parent's graph. The public layer supplies validated
sharing ids from that graph and a graph containing the selected replacements.

- [x] Add failing internal-runtime tests. Construct graph with owned `config`,
  scoped `service` depending on config, then `child = parent.scope(overridden,
  [graph.publicBinding('service')])`; require shared service identity, parent
  configuration, overridden child config, and exactly-once parent finalization.
- [x] Run `bun test tests/selected-scope-runtime.test.ts` and record RED.
- [x] Route explicitly shared ids to the immediate parent; route root ids to
  the earliest ancestor whose graph contains the identity. Apply that same
  route to inspection. Preserve strict-root validation before routing, family
  edges, in-flight dependency admission and parent-owned context.
- [x] Test nested selection, child-defined roots, inherited root construction,
  pending deduplication/retry, cycles, late dependency reads during tree close,
  context abort isolation, and private module bindings using real internal graphs.
- [x] Run the new suite plus scopes/lifetimes/startup tests, self-review and commit.

### Task 2: Expose checked selected scopes

**Files:** `src/di-bag.ts`, new `src/scope-selection.ts`, new `src/scope-types.ts`,
`src/lifetime-types.ts`, `src/index.ts`, `tests/selected-scopes.test.ts`,
`tests/types/selected-scopes.ts`, `tests/types/selected-scopes-consumer.ts`,
`tests/types/negative/selected-scopes.ts`, existing scope fixtures.
**Interface:** `scope()`, `scope({share: tuple})`,
`scope(keys, overrides, {share: tuple}?)` with fork-compatible override inference.

- [x] Add RED public runtime and type fixtures for sharing with child overrides.
  Use `root.scope(['config'], {config: () => ({id: 'child'})}, {share: ['service']})`;
  require unchanged service output and exact inferred override additions.
- [x] Validate inputs before override getters and build at most one graph.
  Share and override selections accept only public strings/genuine token handles;
  snapshot indices, ignore unselected properties, and reject conflicts/transients.
- [x] Reuse selected override contracts and check newly introduced root providers
  against the child graph. Preserve Bag invariants and fork lifetime revalidation.
- [x] Cover hidden keys, mutated tuples, overridden iterators, prototypes, duplicate
  selections, no options, empty selections, selected symbol tokens, raw/native
  values, inferred methods, missing/wrong dependencies, finite tuples, forged
  tokens, private module names, module obligations and lifetime violations.
- [x] Run focused runtime and compiler tests; task review and corrections.

### Task 3: Installed contracts, documentation and checkpoint

**Files:** `tests/package.test.ts`, `tests/native-package.test.ts`,
`tests/box-contract-fixtures.ts`, new `tests/selected-scope-runtime-fixture.ts`,
`README.md`, `CHANGELOG.md`, migration, program tracker and evidence report.

- [x] Include new positive/negative contracts in actual packed classic/native CJS
  and ESM consumers; emit inferred producer declarations, remove producer source,
  then compile downstream consumers through the physical declaration files.
- [x] Execute shared/override identity, root anchoring, pending identity and
  disposal assertions on Node and Bun for both archive emitters/module formats.
- [x] Document the public calls, context anchoring, sharing restrictions and
  ownership. Update the lifecycle checklist only after the evidence passes.
- [x] Run `npm run check`, strict native typecheck/build, `npm run check:native`,
  all examples and `git diff --check`. Record exact outcomes in the report.
- [ ] Independent review of the full increment, resolve findings, commit, push
  non-force to `origin feat/v0.1` and compare the remote SHA with local HEAD.
