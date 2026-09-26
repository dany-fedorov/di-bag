# Module Installation Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue #42 by exposing sealed module labels and explicit installation ancestry in graph snapshots.

**Architecture:** Keep labels as descriptive strings. Store installation records independently of bindings in the persistent graph and remap installation identities when installing nested modules. Bindings reference their innermost installation.

**Tech Stack:** TypeScript, Bun runtime tests, TypeScript compiler fixtures, TypeDoc Markdown generation.

**Spec:** `docs/superpowers/specs/2026-09-26-module-installations-design.md`

## Global Constraints

- String service keys and module labels continue to accept `/`.
- Binding labels retain their current format and are not unique identifiers.
- No new dependencies, version bump, error codes, or resolution/disposal changes.
- Snapshot records and arrays are frozen; inspection never acquires services.
- Ordinary registration/copy operations must not scan all installation records.
- Use GPT-6 Sol at medium effort for every worker and reviewer, as requested.
- Work in the current clean checkout on `fix/module-installation-snapshots`; preserve unrelated changes. Do not push, merge, or publish.

## Task 1: Implement module labels, installation records, and contract tests

**Files:**
- Modify `src/module.ts`: getter and installation remapping.
- Modify `src/runtime.ts`: graph storage, copies, descriptions, installation merge, binding snapshots.
- Modify `src/inspection.ts` and `src/index.ts`: public snapshot type and fields.
- Create `tests/module-installations.test.ts`: runtime regression coverage.
- Create `tests/types/module-installations.ts`: compiler contract coverage.
- Modify `tests/types.test.ts`: register positive compiler fixture; add emitted-declaration coverage where appropriate.
- Modify existing snapshot expectation tests only where the additive fields change exact expected objects.

**Interfaces:**
- Consumes existing `GraphDescription`, `BindingDescription`, `BindingGraph`, and `moduleGraph`.
- Produces exactly the public contract in the spec. Internal fields can be optional for existing graph fixtures.

- [ ] **Step 1: Write failing runtime and compiler tests.** Start with a module whose every binding is exported and assert both its property and graph record:

```ts
const feature = DiBag.createBuilder()
  .withServices({ answer: () => 42 })
  .buildModule({ exportedServiceKeys: ['answer'], moduleLabel: 'application.capacity' });
expect(feature.moduleLabel).toBe('application.capacity');
const container = DiBag.createBuilder().withInstalledModules([feature]).buildContainer();
const snapshot = container.graphSnapshot();
expect(snapshot.moduleInstallations).toHaveLength(1);
expect(snapshot.moduleInstallations[0]).toEqual({
  installationId: expect.any(Symbol),
  moduleLabel: 'application.capacity',
  parentInstallationId: undefined,
});
expect(snapshot.bindings[0]!.moduleInstallationId)
  .toBe(snapshot.moduleInstallations[0]!.installationId);
await container.close();
```

Add separate behavioral cases for each item below. Use real builders and close
all created containers. Run tests red before implementing each behavior group.

| Scenario | Required assertion |
| --- | --- |
| Absent label and both rename views | Exact original label; no inherited inner label; `Reflect.set` rejects a write |
| Forged string prefix | Unlabelled installation despite identical old `bindingLabel` |
| Unlabelled wrapper | Two records, child points to unlabelled parent |
| Empty module and nested empty module | Records exist despite no bindings |
| Two renamed installations | Disjoint IDs for each full subtree; bindings point to correct descendant |
| Siblings | Parent-first, contiguous subtree, installation order |
| Host service, alias to module export | `undefined` origin for each host declaration |
| Module alias and contribution/token | Innermost module ID; alias target remains separate |
| Host replacement | New binding has `undefined`; retained old private bindings preserve origin |
| Replace all exported bindings | Installation record remains |
| Child/independent/repeated build | Inherited IDs remain stable; replacements have host origin |
| Snapshot immutability | Frozen array and entries; old snapshots cannot be mutated |
| Lazy providers | Snapshot and label reads leave acquisition counter at zero |
| Slash names/labels | Registration, alias and both renames still accept `/` |

The compiler fixture should assert the exported type and reject mutation:

```ts
import { DiBag, type ModuleInstallationSnapshot } from '../../src';
const feature = DiBag.createBuilder().buildModule({ exportedServiceKeys: [], moduleLabel: 'empty' });
const label: string | undefined = feature.moduleLabel;
// @ts-expect-error Module labels are read-only.
feature.moduleLabel = 'changed';
const graph = DiBag.createBuilder().withInstalledModules([feature]).buildContainer().graphSnapshot();
const records: readonly ModuleInstallationSnapshot[] = graph.moduleInstallations;
// @ts-expect-error Snapshot records are read-only.
records[0]!.moduleLabel = 'changed';
// @ts-expect-error Snapshot arrays are read-only.
records.push(records[0]!);
```

- [ ] **Step 2: Run focused red tests.** Run `bun test tests/module-installations.test.ts` and the compiler fixture test. Confirm missing property/records cause the failures, not unrelated setup.
- [ ] **Step 3: Add the getter and public declarations.** Use the existing module WeakMap without duplicated mutable label state:

```ts
get moduleLabel(): string | undefined {
  return descriptions.get(this)!.label;
}
```

Copy the `ModuleInstallationSnapshot`, `GraphSnapshot.moduleInstallations`, and
`BindingSnapshot.moduleInstallationId` declarations from the spec. Give each new
public type/member a useful source comment for generated documentation.

- [ ] **Step 4: Carry installation data through the graph.** Reuse
`Sequence<ModuleInstallationSnapshot>` and `append`/`materialize` for persistent
storage, with an empty frozen array for graphs without installations. Copy the
sequence root in `BindingGraph.copy()`. Preserve each binding's optional internal
origin in the constructor. New host bindings start with no origin. Include the
records in `describe()` and append incoming records in `withInstallation()` even
when no bindings arrive. Emit the origin on graph binding snapshots only.

- [ ] **Step 5: Remap installations at module installation.** In `moduleGraph`,
create the outer record and one old-ID/new-ID map for the entire nested table:

```ts
const installationId = Symbol('module installation');
const remapped = new Map<symbol, symbol>();
for (const nested of graph.moduleInstallations ?? []) {
  remapped.set(nested.installationId, Symbol('module installation'));
}
const installations = [{ installationId, moduleLabel: label, parentInstallationId: undefined },
  ...(graph.moduleInstallations ?? []).map(nested => ({
    installationId: remapped.get(nested.installationId)!,
    moduleLabel: nested.moduleLabel,
    parentInstallationId: nested.parentInstallationId === undefined
      ? installationId : remapped.get(nested.parentInstallationId)!,
  }))];
```

Freeze records/arrays at the graph boundary. A binding with no old origin gets
the new outer ID; one with an old origin gets its mapped ID. Preserve existing
binding label, export, requirement, contribution, and lexical-name behavior.

- [ ] **Step 6: Run focused green tests and typecheck.** Run
`bun test tests/module-installations.test.ts tests/modules.test.ts tests/nested-modules.test.ts tests/persistent-module.test.ts tests/requirement-renaming.test.ts` and `npm run typecheck`.
- [ ] **Step 7: Self-review and report.** Record red/green evidence, files, and
remaining concerns in the assigned report. Commit only owned code/test files if
git permissions permit; otherwise leave them reviewable and report it. The
controller handles full-suite validation and independent review.

## Task 2: Document the public contract and generate references

**Files:**
- Modify `CONTEXT.md`: define Module label and Module installation in domain terms.
- Modify `docs/guides/tutorial.md`: label getter and structured snapshot example.
- Modify `docs/guides/api-reference.md`: new property and snapshot type.
- Modify `tools/docs/api-card-tasks.json` if the card needs a label-read task;
  inspect the renderer's supported property shapes before adding one.
- Regenerate `docs/reference/**` and `docs/agent/api-card.md` via the generator.

**Interfaces:**
- Consumes Task 1's exact public contract and source comments.
- Produces documentation matching graph identity, ancestry, and replacement semantics.

- [ ] **Step 1: Add domain definitions.** Explain module label as optional,
non-unique descriptive text and installation as one occurrence of a module in
a builder graph, possibly nested. Do not put implementation details in the glossary.
- [ ] **Step 2: Document label reading and traversal.** Add a concise example:

```ts
const graph = container.graphSnapshot();
const installations = new Map(graph.moduleInstallations.map(record => [record.installationId, record]));
const binding = graph.bindings.find(binding => binding.serviceKeys.includes('answer'))!;
const installation = binding.moduleInstallationId === undefined
  ? undefined : installations.get(binding.moduleInstallationId);
console.log(installation?.moduleLabel);
```

Explain parent traversal, undefined host origin, unlabelled/empty installations,
repeated-installation fresh IDs versus container-copy stable IDs, alias/replacement
origin, frozen records, and why labels or `/` prefixes are not identities.
- [ ] **Step 3: Generate and verify docs.** Run `npm run docs:generate`, then
`npm run docs:check`. Fix source comments or guide text, never generated Markdown
by hand. Do not update unrelated generated artifacts unless generation requires it.
- [ ] **Step 4: Self-review and report.** Commit only owned documentation files
if permitted. Report validation and any generator limitations.

## Final integration and verification

- [ ] Review each task for spec compliance and quality with a fresh GPT-6 Sol medium worker.
- [ ] Run `npm run check` (typecheck, both test lanes, build), `npm run typecheck:native`, and `npm run docs:check` on the final tree. Record environment failures precisely and exhaust relevant safe alternatives.
- [ ] Review the whole change, including graph persistence and nested ID remapping.
- [ ] Update this checklist and hand off the feature branch; do not push, merge, publish, or close the issue.
