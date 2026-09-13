# Runtime Graph Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an application, a tool, or an agent list everything a bag can resolve and the dependency edges it has observed, without acquiring anything: `bag.inspectGraph()`.

**Architecture:** `BindingGraph` already knows every binding, public slot, and contribution group (`describe()` snapshots them for module sealing). `ScopeAcquisitions` and `AcquisitionFamily` already record consumer-to-dependency edges per attempt for cycle detection and cleanup ordering. `inspectGraph()` joins those: binding summaries from the graph, per-binding metadata and attempts from the existing `inspect` path, and de-duplicated observed edges from the family. Named dependencies are unknown at runtime by design; the snapshot says so and the static tool (plan 06) supplies them.

**Tech Stack:** TypeScript, bun:test.

**Spec:** `docs/superpowers/specs/2026-09-13-agentic-scale-hardening.md` (decision D2, runtime half)

## Global Constraints

- Minimum supported TypeScript 6.0.3; `npm run check:native` must keep passing.
- Zero runtime, peer, optional, and bundled dependencies.
- Snapshots are frozen point-in-time copies: no live maps, no service values, no retained closures.
- `inspectGraph()` must not acquire, must work after `close()`, and must be cheap relative to `inspect()` per binding.
- `npm run check` passes before every commit; `npm run docs:generate` after public API changes.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

---

### Task 1: Snapshot types and the graph-side summaries

**Files:**
- Modify: `src/inspection.ts` (imports; two new interfaces)
- Modify: `src/runtime.ts` (`BindingGraph`: two new methods after `describe()`)
- Test: `tests/inspect-graph.test.ts` (new; first test only in this task)

**Interfaces:**
- Produces: `export interface BindingSnapshot<M, A>` and `export interface GraphSnapshot` in `src/inspection.ts`; `BindingGraph.bindingSummaries()` and `BindingGraph.contributionGroups()` (internal).

- [ ] **Step 1: Write the failing test**

```ts
// tests/inspect-graph.test.ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

test('inspectGraph lists public bindings in registration order without acquiring', async () => {
  let created = 0;
  const bag = DiBag.createBuilder()
    .register({
      config: DiBag.withLifetime(() => { created++; return { url: 'x' }; }, 'root'),
      db: DiBag.withLifetime(DiBag.withDisposal(({ config }: { config: { url: string } }) => { created++; return { url: config.url }; }, () => {}), 'root'),
    })
    .register({ handler: DiBag.withMetadata(({ db }: { db: { url: string } }) => () => db.url, { static: { 'app:kind': 'http' } }) })
    .alias('client', 'db')
    .build();
  const graph = bag.inspectGraph();
  expect(created).toBe(0);
  expect(Object.isFrozen(graph)).toBe(true);
  expect(graph.bindings.map(binding => binding.keys)).toEqual([['config'], ['db'], ['handler'], ['client']]);
  const byKey = new Map(graph.bindings.map(binding => [binding.keys[0], binding]));
  expect(byKey.get('config')).toMatchObject({ label: 'config', lifetime: 'root', owned: false, acquisitionMode: 'auto', acquisitions: [] });
  expect(byKey.get('db')).toMatchObject({ lifetime: 'root', owned: true });
  expect(byKey.get('handler')!.registrationMetadata).toEqual({ 'app:kind': 'http' });
  expect(byKey.get('client')!.aliasTarget).toEqual({ bindingId: byKey.get('db')!.bindingId, label: 'db' });
  expect(graph.observedEdges).toEqual([]);
  expect(graph.contributions).toEqual([]);
  await bag.close();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test tests/inspect-graph.test.ts`
Expected: FAIL with `bag.inspectGraph is not a function`.

- [ ] **Step 3: Add the snapshot types to `src/inspection.ts`**

Add these imports at the top of `src/inspection.ts`:

```ts
import type { AcquisitionMode } from './acquisition-mode';
import type { Lifetime } from './lifetime';
```

Append at the end of the file:

```ts
/** One binding of a bag's graph, described without acquiring it. */
export interface BindingSnapshot<M = Readonly<{}>, A extends readonly unknown[] = readonly []> extends RegistrationSnapshot<M, A> {
  /** Public names or token symbols that select this binding, in registration order; empty for a private module binding. */
  readonly keys: readonly (string | symbol)[];
  readonly lifetime: Lifetime;
  readonly acquisitionMode: AcquisitionMode;
  /** True when some stage of the provider accepts ownership through a disposer. */
  readonly owned: boolean;
  /** Typed-token dependencies declared positionally through tokens, `optional`, `lazy`, or `all` references. */
  readonly tokenDependencies: readonly { readonly key: symbol; readonly kind: 'required' | 'optional' | 'lazy' | 'all' }[];
}

/**
 * A frozen description of every binding a bag can resolve, plus the edges observed so far.
 * Named dependencies read from a factory's object parameter are not knowable until the factory
 * runs; `observedEdges` records them after acquisition. Use the static graph tool for declared edges.
 */
export interface GraphSnapshot {
  readonly scopeId: symbol;
  /** Public bindings in registration order, then contributions in group order, then remaining private bindings. */
  readonly bindings: readonly BindingSnapshot<object, readonly unknown[]>[];
  readonly contributions: readonly { readonly token: symbol; readonly bindingIds: readonly symbol[] }[];
  /** Consumer-to-dependency edges recorded by acquisitions in this bag's ownership family. */
  readonly observedEdges: readonly { readonly from: symbol; readonly to: symbol }[];
}
```

- [ ] **Step 4: Add the summaries to `BindingGraph` in `src/runtime.ts`**

Insert after the `describe()` method:

```ts
  /** Every retained binding in `describe()` order, with the public keys that select it. */
  bindingSummaries(): readonly { readonly id: BindingId; readonly keys: readonly BindingKey[] }[] {
    const keysById = new Map<BindingId, BindingKey[]>();
    if (this.#publicOrder) for (const key of materialize(this.#publicOrder)) {
      const id = this.#publicSlots.get(key);
      if (id === undefined) continue;
      const keys = keysById.get(id) ?? [];
      if (!keys.includes(key)) keys.push(key);
      keysById.set(id, keys);
    }
    return Object.freeze([...this.describe().bindings.keys()].map(id => Object.freeze({ id, keys: Object.freeze(keysById.get(id) ?? []) })));
  }

  /** Every contribution group with its member bindings in contribution order. */
  contributionGroups(): readonly { readonly token: symbol; readonly bindingIds: readonly BindingId[] }[] {
    const groups: { readonly token: symbol; readonly bindingIds: readonly BindingId[] }[] = [];
    for (const [key] of this.#contributions) groups.push(Object.freeze({ token: key as symbol, bindingIds: this.contributionBindings(key as symbol) }));
    return Object.freeze(groups);
  }
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean. (The test still fails; `inspectGraph` arrives in Task 2.)

- [ ] **Step 6: Commit**

```bash
git add src/inspection.ts src/runtime.ts tests/inspect-graph.test.ts
git commit -m "feat: describe binding summaries and contribution groups on the graph"
```

---

### Task 2: Observed edges and the `inspectGraph()` method

**Files:**
- Modify: `src/acquisition-family.ts` (new `observedEdges()` method)
- Modify: `src/acquisition.ts` (new `observedEdges()` passthrough on `ScopeAcquisitions`)
- Modify: `src/runtime.ts` (`BagRuntime.inspectGraph()`; import `GraphSnapshot`)
- Modify: `src/di-bag.ts` (`Bag.inspectGraph()`; import `GraphSnapshot`)
- Modify: `src/index.ts` (export `BindingSnapshot`, `GraphSnapshot`)
- Test: `tests/inspect-graph.test.ts` (append)

- [ ] **Step 1: Extend the test file**

Append:

```ts
test('inspectGraph reports observed edges, contributions, private module bindings, and attempts', async () => {
  const toolKey = Symbol('tool');
  const tool = DiBag.token(toolKey).of<string>();
  const feature = DiBag.createBuilder()
    .register({ secret: () => 'hidden', exported: ({ secret }: { secret: string }) => secret.length })
    .contribute(tool, () => 'a')
    .buildModule(['exported']);
  const bag = DiBag.createBuilder()
    .installModule(feature)
    .contribute(tool, ({ exported }: { exported: number }) => `b${exported}`)
    .register({ reader: DiBag.fromFunction([DiBag.all(tool), DiBag.optional(tool)], (tools, _maybe) => tools.length) })
    .build();

  const before = bag.inspectGraph();
  const labels = before.bindings.map(binding => binding.label);
  expect(labels).toContain('secret');
  expect(before.bindings.find(binding => binding.label === 'secret')!.keys).toEqual([]);
  expect(before.bindings.find(binding => binding.label === 'exported')!.keys).toEqual(['exported']);
  expect(before.contributions).toHaveLength(1);
  expect(before.contributions[0]!.token).toBe(toolKey);
  expect(before.contributions[0]!.bindingIds).toHaveLength(2);
  expect(before.bindings.find(binding => binding.label === 'reader')!.tokenDependencies).toEqual([
    { key: toolKey, kind: 'all' }, { key: toolKey, kind: 'optional' },
  ]);

  expect(bag.resolve('reader')).toBe(2);
  const after = bag.inspectGraph();
  const id = (label: string) => after.bindings.find(binding => binding.label === label)!.bindingId;
  const edges = after.observedEdges.map(edge => [after.bindings.find(b => b.bindingId === edge.from)!.label, after.bindings.find(b => b.bindingId === edge.to)!.label]);
  expect(edges).toContainEqual(['reader', `contribution:${String(toolKey)}`]);
  expect(edges).toContainEqual(['exported', 'secret']);
  expect(after.bindings.find(binding => binding.label === 'exported')!.acquisitions.map(attempt => attempt.state)).toEqual(['ready']);
  // Symbols with equal descriptions stringify alike; compare edge identities pairwise.
  const pairs = after.observedEdges.map(edge => [edge.from, edge.to] as const);
  expect(pairs.filter((pair, index) => pairs.findIndex(other => other[0] === pair[0] && other[1] === pair[1]) !== index)).toEqual([]);
  expect(pairs).toHaveLength(4);
  void id;

  await bag.close();
  const closed = bag.inspectGraph();
  expect(closed.bindings.every(binding => binding.acquisitions.length === 0)).toBe(true);
  expect(closed.observedEdges).toEqual([]);
});

test('a child scope reports its own scope id and the family edges', async () => {
  const root = DiBag.createBuilder().register({ shared: DiBag.withLifetime(() => 1, 'root'), local: ({ shared }: { shared: number }) => shared + 1 }).build();
  const child = root.createScope();
  expect(child.inspectGraph().scopeId).not.toBe(root.inspectGraph().scopeId);
  expect(child.resolve('local')).toBe(2);
  expect(child.inspectGraph().observedEdges).toHaveLength(1);
  expect(root.inspectGraph().observedEdges).toHaveLength(1);
  await root.close();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/inspect-graph.test.ts`
Expected: FAIL with `bag.inspectGraph is not a function`.

- [ ] **Step 3: Record observed edges in `AcquisitionFamily`**

Add to `src/acquisition-family.ts`, after `dependencyPath`:

```ts
  /** Distinct consumer-to-dependency binding edges recorded by live attempts, in attempt order. */
  observedEdges(): readonly { readonly from: BindingId; readonly to: BindingId }[] {
    const seen = new Map<BindingId, Set<BindingId>>();
    const edges: { readonly from: BindingId; readonly to: BindingId }[] = [];
    for (const attempt of this.attempts.values()) {
      for (const dependency of attempt.dependencies) {
        const target = this.attempts.get(dependency);
        if (!target) continue;
        let targets = seen.get(attempt.bindingId);
        if (!targets) seen.set(attempt.bindingId, targets = new Set());
        if (targets.has(target.bindingId)) continue;
        targets.add(target.bindingId);
        edges.push(Object.freeze({ from: attempt.bindingId, to: target.bindingId }));
      }
    }
    return Object.freeze(edges);
  }
```

- [ ] **Step 4: Expose the edges from `ScopeAcquisitions`**

Add to `src/acquisition.ts`, after `inspectDescription`:

```ts
  observedEdges(): readonly { readonly from: BindingId; readonly to: BindingId }[] { return this.family.observedEdges(); }
```

- [ ] **Step 5: Build the snapshot in `BagRuntime`**

In `src/runtime.ts`, extend the inspection import:

```ts
import type { GraphSnapshot, RegistrationSnapshot } from './inspection';
```

Add to `BagRuntime`, after `inspect`:

```ts
  inspectGraph(): GraphSnapshot {
    const bindings = this.graph.bindingSummaries().map(({ id, keys }) => {
      const description = this.graph.registration(id);
      return Object.freeze({
        ...this.inspectBinding(id),
        keys,
        lifetime: description.lifetime.kind,
        acquisitionMode: description.acquisitionMode,
        owned: description.dispose !== undefined || description.operations.some(operation => operation.kind === 'owned'),
        tokenDependencies: Object.freeze(description.references.map(reference => Object.freeze({ key: reference.key, kind: reference.kind }))),
      });
    });
    return Object.freeze({
      scopeId: this.acquisitions.ownerId,
      bindings: Object.freeze(bindings),
      contributions: this.graph.contributionGroups(),
      observedEdges: this.acquisitions.observedEdges(),
    });
  }
```

`inspectBinding` follows alias targets for `acquisitions` and reports `aliasTarget`; an alias binding's own `lifetime` is its declared policy, which is what the snapshot shows.

- [ ] **Step 6: Add the public method to `Bag` in `src/di-bag.ts`**

Extend the inspection import:

```ts
import type { GraphSnapshot, RegistrationSnapshot } from './inspection';
```

Insert after the `inspect` overloads:

```ts
  /**
   * Describe every binding this bag can resolve and the dependency edges observed so far.
   * Nothing is acquired. Named dependencies declared on factory parameters are not visible
   * until the factory runs; the static graph tool reports them from source.
   * @returns A frozen point-in-time snapshot; application-owned metadata payloads are not frozen.
   */
  inspectGraph(): GraphSnapshot { return this.#runtime.inspectGraph(); }
```

- [ ] **Step 7: Export the types**

In `src/index.ts`, change the inspection export line to:

```ts
export type { Presence, AcquisitionMetadataPresence, AcquisitionSnapshot, RegistrationSnapshot, BindingSnapshot, GraphSnapshot } from './inspection';
```

- [ ] **Step 8: Run the tests**

Run: `npm run typecheck && bun test tests/inspect-graph.test.ts tests/acquisition.test.ts tests/scopes.test.ts tests/contributions.test.ts`
Expected: all PASS. If the contribution label differs from `contribution:Symbol(tool)`, read `withContribution` in `src/runtime.ts` (it labels with `` `contribution:${String(key)}` ``) and align the assertion.

- [ ] **Step 9: Commit**

```bash
git add src/acquisition-family.ts src/acquisition.ts src/runtime.ts src/di-bag.ts src/index.ts tests/inspect-graph.test.ts
git commit -m "feat: add bag.inspectGraph with observed dependency edges"
```

---

### Task 3: Docs and changelog

**Files:**
- Modify: `docs/guides/tutorial.md` (end of "Attach metadata and inspect without resolving", before `## Observe lifecycle transitions`)
- Modify: `docs/guides/api-reference.md` (`### Use and close a bag` table; `### Application-facing types` table)
- Modify: `docs/guides/agent-harnesses-and-graphs.md` (the "Inspectable capability descriptions" bullet)
- Modify: `README.md` (the sentence "Inspection describes selected registrations, not complete dependency edges")
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Tutorial paragraph**

Insert before `## Observe lifecycle transitions`:

```markdown
`inspectGraph()` describes the whole bag at once: every binding with its public
keys, label, lifetime, acquisition mode, ownership, typed-token dependencies,
static metadata, and current attempts; every contribution group; and the
consumer-to-dependency edges observed during acquisition so far. Private
bindings from installed modules appear with an empty key list. Nothing is
acquired, and the snapshot is frozen. Named dependencies read from a factory's
object parameter are unknown until that factory runs, so the edge list grows as
services are acquired; the static graph tool reports declared edges from source.

```ts
const graph = app.inspectGraph();
graph.bindings.map(binding => [binding.keys, binding.lifetime]);
graph.observedEdges; // [] before any resolve
```
```

- [ ] **Step 2: API reference rows**

In `### Use and close a bag`, after the `inspectAll(token)` row:

```markdown
| `inspectGraph()` | Describe every binding, contribution group, and [observed edge](tutorial.md#attach-metadata-and-inspect-without-resolving) without resolving. |
```

In `### Application-facing types`, add:

```markdown
| `GraphSnapshot`, `BindingSnapshot` | The frozen result of `inspectGraph()` and its per-binding entries. |
```

- [ ] **Step 3: Agent guide and README**

In `docs/guides/agent-harnesses-and-graphs.md`, change the sentence "Inspection describes selected registrations and acquisitions; it does not export a complete dependency-edge graph." to:

```markdown
`inspect` describes one registration, `inspectGraph` describes every binding and
the edges observed so far, and the static graph tool exports declared edges from
source.
```

In `README.md`, change "Inspection describes selected registrations, not complete dependency edges; observers track acquisition, not ordinary node calls." to:

```markdown
`inspectGraph()` lists every binding and the edges observed at runtime; declared
edges come from the static graph tool. Observers track acquisition, not ordinary node calls.
```

- [ ] **Step 4: Changelog, regeneration, check, commit**

Under `## Unreleased`:

```markdown
- Add `bag.inspectGraph()` with `GraphSnapshot` and `BindingSnapshot`: every
  binding, contribution group, and observed dependency edge, without acquiring.
```

Run: `npm run docs:generate && npm run docs:check && npm run check`
Expected: PASS.

```bash
git add docs README.md CHANGELOG.md
git commit -m "docs: describe inspectGraph"
```
