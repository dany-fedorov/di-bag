# di-bag-graph

Static check for [DI Bag](https://github.com/dany-fedorov/di-bag) builder
chains. It reads a TypeScript project, finds every `DiBag.createBuilder()`
chain that ends in `build()` or `buildModule()`; a `build()` followed by
`ensureServicesReady()` counts, and so does the 0.4 `buildAndStart()`.
It reports dependency cycles and unresolved names before any factory runs.

It is a merge-review and CI tool, not a code map. To find code, read the module
directories; to check wiring types, use `verifyGraph()`.

## Commands

```sh
npm install --save-dev di-bag-graph
npx di-bag-graph --check                  # exit 1 on any issue; reads ./tsconfig.json
npx di-bag-graph --project tsconfig.json --out graph.json
```

Pass `--project <tsconfig>` or source files; without either, `./tsconfig.json`
is used. Without `--out` or `--check`, the JSON goes to stdout. Every run prints
a summary line with the TypeScript version used, then one line per issue:

```text
3 units, 5 nodes, 1 issues (TypeScript 6.0.3, project)
cycle in src/app.ts:6: fulfillmentModule/stock -> invoicingModule/invoicing -> invoicingModule/store -> fulfillmentModule/fulfillment -> fulfillmentModule/stock
```

Exit codes: `0` no issues or no `--check`; `1` issues with `--check`; `2`
usage or tsconfig error.

## What `--check` fails on

- **cycle**: a dependency path returns to its start. Cycles through installed
  modules are found: a module's private nodes appear as `<label>/<key>`, where
  the label is `buildModule(keys, { label })` when given, as in runtime
  messages, and otherwise the expression passed to `installModule`. A cycle
  inside one module is reported once, on that module.
- **unresolved**: a bag (`build()`) has a declared
  dependency that no registration, alias, installed module export, or its
  requirement supplier provides. A module's unmet names are not issues; they are
  its `requirements`.

It does not fail on type mismatches (`tsc` and `verifyGraph()` do) and it does
not run factories.

## JSON

```text
{ version: 1, units: Unit[], issues: Issue[] }
```

- `Unit`: one builder chain.
  - `id`: `<file>:<line>` of the chain start, relative to the working directory.
  - `kind`: `bag` or `module`.
  - `label` (modules only, when given): the `buildModule` label.
  - `exports`: keys passed to `buildModule`.
  - `installs`: ids of installed module units, or the source text of an
    install the tool cannot trace to a `buildModule` chain.
  - `requirements` (modules only): names the installing host must supply.
  - `nodes`: `{ key, line, dependencies, async, lifetime, owned }` per
    registration. `dependencies` are the property names of the factory's first
    parameter type; `async` means the factory returns a `Promise`; `lifetime`
    is `root`, `scoped`, or `transient`; `owned` means `withDisposal`.
  - `edges`: `{ from, to }` for the unit's own registrations, sorted.
- `Issue`: `{ kind: 'cycle', unit, path }` or
  `{ kind: 'unresolved', unit, consumer, dependency }`.

## Limits

- Chains are found syntactically: a builder must start with `createBuilder()`,
  and partial builders must be `const` variables, possibly imported.
- Dependencies come from declared parameter types. A factory typed as `any`
  contributes no edges.
- An install that is not a traceable module variable (for example a function
  call) may supply any name, so its host reports no unresolved names.

## TypeScript

The tool uses the project's `typescript` package when it resolves from the
tsconfig directory and exposes the compiler API at version 6.0.3 or later, so
the analysis matches the project's `tsc`. Otherwise, including projects on
TypeScript 7, whose package has no compatible JavaScript API, it uses its own
TypeScript 6 dependency. No extra setup is needed in either case.

## Library

```js
import { extractDependencyGraph } from 'di-bag-graph';
const graph = extractDependencyGraph({ project: 'tsconfig.json' });
```

MIT license.
