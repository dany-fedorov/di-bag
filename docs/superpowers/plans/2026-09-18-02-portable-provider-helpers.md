# Portable Provider Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close issue #28: give cross-runtime graphs two additive facade helpers, `DiBag.fromSyncFactory(create, options?)` and `DiBag.fromAsyncFactory(create, options?)`, that fix the acquisition mode from their name and reject a mismatched output at compile time, and make `DI_BAG_CLASSIFIER_REQUIRED` name every registration that still uses automatic acquisition.

**Architecture:** Both helpers are `fromFactory` with the mode fixed: `fromSyncFactory` is a `raw` stage guarded by a new `SyncOutput<O>` type (no Promise, no structural thenable), `fromAsyncFactory` is a `nativePromise` stage guarded by a new `AsyncOutput<O>` type (Promise required). They share `fromFactory`'s provider construction in `src/acquisition-context.ts`, so ownership, dependency inference, modules, scopes, forks and disposal are the existing code paths. `BindingGraph.preflight` in `src/runtime.ts` collects the labels of every automatic binding before throwing. No runtime classifier is added anywhere.

**Tech Stack:** TypeScript conditional types and overloads, bun:test, the classic (`tsc6`) and native (`tsc`) compilers, the Playwright/Chromium browser-Worker evidence lane.

**Spec:** the issue (`gh issue view 28`) and the **Design** section of this document. There is no separate spec file.

**Starting point:** this plan lands after `feat/push-disposer` merges; it is written against that branch at e1d4037 (main at 2e6602f plus `pushDisposer`). Every file reference below uses that tree. Prototypes in the session scratchpad `<scratchpad>/proto/`: `helpers.ts` (the exact types and overloads of Task 1, validated with `tsc6` and native `tsc`), `positive.ts` and `negative.ts` (the fixtures, with both compilers' printed diagnostics recorded in Task 1), `runtime.test.ts` (6/6 under bun), `src/` (a copy of `src/` with the Task 3 preflight change) and `preflight.test.ts` (4/4 modulo label order, which Task 3 sorts). Reuse that code.

## Global Constraints

- Zero runtime dependencies; minimum TypeScript 6.0.3; `npm run check:native` must keep passing.
- Library errors only through `libraryError` with a `DI_BAG_*` code and frozen `details`. No new code: the helpers reuse `DI_BAG_INVALID_FACTORY`; the classifier error keeps `DI_BAG_CLASSIFIER_REQUIRED`.
- Compile-time messages are `Unsatisfied<message, details>` and end with `SeeErrors<'family'>`; every family needs a `{#family}` heading in `docs/agent/errors.md` (`tools/docs/lib/agent-docs.mjs` `checkErrorCoverage`).
- `AGENTS.md` is at 150/150 lines (`agentsBudget`); every edit keeps it at 150 or fewer. Each `##` recipe in `docs/agent/recipes.md` stays under 60 lines (`recipeBudget`; `lines >= 60` is an error). `docs/agent/api-card.md` (337 lines) stays at or under 400 and is generated: never hand-edit it.
- `npm run docs:check` type-checks every snippet in `AGENTS.md`, `docs/agent/*.md` and every `@example` in `src/` JSDoc against declarations emitted from `src`; `// expect-error: <fragment>` marks a counterexample.
- `CHANGELOG.md` gains no `## Unreleased` heading (`tests/release-artifacts.test.ts`); the changelog text lives in Task 6.
- Negative fixture markers (`// diagnostic: <substring>`) must match tsc6 and native tsc; where native prints only the last overload, declare a `// diagnostic-native-gap: <id>` whose exact text is in `tests/native-diagnostic-markers.ts`. Verify with the commands in Task 1 Step 7, never by guessing.
- Package tests print an npm update notice to stderr under some npm versions; run the compiler lane as `npm_config_update_notifier=false npm run test:compiler`. `tests/package.test.ts` also has a pre-existing 5 s timeout flake under load; rerun it alone before treating it as a regression.
- Release gates use pinned Bun 1.4.0 (`npm run platform:pin`); the local 1.4.2 is fine for development.
- Retention suites are CI-only: `npm run build && node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs` at the end of Tasks 1 and 3.
- Parameter names in every doc, JSDoc, test and fixture: `factoryCtx` for the factory context, `disposerCtx` for the disposer context. Never `context` or `ctx`.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. `npm run typecheck && npm run test:fast` before every commit.

---

## Design

### Problem

`di-bag` 0.3.0 classifies native Promises with `util.types.isPromise`, loaded through `process.getBuiltinModule` at the first `build()` that has an `auto` stage (`src/acquisition-mode.ts` `hostClassifier`, called from `BindingGraph.preflight` in `src/runtime.ts:169`). Browsers and Web Workers have no `process.getBuiltinModule`, so `build()` throws `DI_BAG_CLASSIFIER_REQUIRED` for any automatic stage, and today it stops at the first one without saying which. A graph meant to run in Bun and in a browser therefore repeats `DiBag.fromFactory(fn, { acquisitionMode: 'raw' | 'nativePromise' })` on every registration, and a forgotten one is found by bisection. The issue asks for a shorter explicitly portable form that keeps Promise-valued dependencies visible, keeps the native-Promise/thenable distinction, and adds no unsafe classifier.

### Decision 1: two helpers, `fromSyncFactory` and `fromAsyncFactory`

`DiBag.fromSyncFactory(create, options?)` is `DiBag.fromFactory(create, { ...options, acquisitionMode: 'raw' })`; `DiBag.fromAsyncFactory(create, options?)` is `DiBag.fromFactory(create, { ...options, acquisitionMode: 'nativePromise' })`. The mode is in the name, so the call site says what the runtime will do, and the compiler checks that the factory's declared output agrees (Decision 2). Both accept `{ context: 'acquisition' }` exactly as `fromFactory` does, so `factoryCtx.signal` and `factoryCtx.pushDisposer` keep working. Existing `fromFactory` forms are unchanged.

Names follow the facade's `from<Noun>` family (`fromFactory`, `fromFunction`, `fromClass`, `fromPlugin`) with the adjective that distinguishes them; CONTEXT.md's term for the callback is *factory*, and the helpers describe providers, so the noun stays `Factory`.

Rejected:

- **A browser-side native-Promise classifier** (`instanceof Promise`, `Promise.resolve(v) === v`, `Promise.prototype.then.call`): the issue forbids it. `instanceof` misclassifies cross-realm Promises and subclasses from other realms; `Promise.resolve(v) === v` reads `v.constructor` and runs a user getter; `then.call` runs user code through `Symbol.species`. The library's own `nativePromise` stage runs `Promise.prototype.then.call` only *after* the caller has declared the value native.
- **A "portable" facade whose plain-function shorthand defaults to `raw`** (`import { DiBag } from 'di-bag/portable'`): the same `register({ db: async () => ... })` line would then mean "observe the Promise" under one import and "the Promise object is the service" under another. The whole design of the library is that a registration's text fixes its semantics.
- **One helper that infers sync/async from the return type** (`fromPortableFactory`): the type could pick the mode, but the runtime cannot without classifying the value, which is the rejected classifier again. Two names, two modes, no inference.
- **A `fromFactory.sync` / `fromFactory.async` namespace or `DiBag.sync` / `DiBag.async`**: properties on a function do not survive `typeof fromFactory` on the facade cleanly, typedoc and the API card enumerate facade *members*, and `async` reads as the keyword.
- **Helpers for `fromFunction`, `fromClass`, `transformService` and `fromPlugin` too** (six more names): `fromPlugin` already requires an explicit mode; the other three already take `{ acquisitionMode }` as an option in a fixed position, so the repetition the issue measured is in `fromFactory`, which has both the option *and* the shorthand-less plain-function form. The docs point those adapters to their option, and the improved error (Decision 5) finds a forgotten one.
- **Changing direct `transformService` to inherit its source's mode instead of defaulting to `auto`**: a behaviour change for every existing direct transform over a `raw` source that returns a Promise (today observed, then not). Out of scope; the error names the transform's registration instead.

### Decision 2: semantics and the compile-time guards

| | `fromSyncFactory` | `fromAsyncFactory` |
| --- | --- | --- |
| Stage mode | `raw` | `nativePromise` |
| Exposed service (`ProviderOutput`) | `ReturnType<F>`, the exact value; `then` is never read | `ReturnType<F>`, the factory's own Promise |
| Acquired value (`ProviderAcquiredValue`, what `withDisposal` receives) | `ReturnType<F>` | `Awaited<ReturnType<F>>` |
| Accepted outputs | anything except a Promise or a structural thenable; `any` and `unknown` are accepted | `Promise<T>` and `Promise` subclasses |
| Rejected outputs (compile time) | `Promise<T>`, `T \| Promise<T>`, `PromiseLike<T>`, any object with a callable `then` | non-Promise values, `T \| Promise<T>`, `PromiseLike<T>` |
| Compile-time message | `fromSyncFactory output must not be a Promise or thenable; use fromAsyncFactory for a Promise, or fromFactory with acquisitionMode raw to make the Promise object the service; see …#portable-factory-output` | `fromAsyncFactory requires a Promise output; use fromSyncFactory for a synchronous value; see …#portable-factory-output` |

`SyncOutput<O>` (new, `src/acquisition-mode.ts`) is `IsAny<O> extends true ? unknown : true extends PromiseOutput<O> | StructuralThenable<O> ? Unsatisfied<…> : unknown`, where `PromiseOutput<O>` distributes over unions the way the existing `StructuralThenable` does (`O extends infer T & {} ? T extends Promise<unknown> ? true : false : false`). `any` is exempt for the same reason `StructuralThenable` exempts it (`tests/api-renaming.test.ts` registers `() => any` factories). Because `StructuralThenable` honours `DiBagPolicy.structuralThenables: 'allow'`, that switch also lets `fromSyncFactory` accept a thenable service, which is consistent: `raw` accepts thenables at runtime.

`AsyncOutput<O>` is `[O] extends [Promise<unknown>] ? unknown : Unsatisfied<…>`, the same test as the existing `NativeOutput` for `nativePromise`.

`fromSyncFactory` is narrower than `raw`: `raw` deliberately admits a Promise as the service ("use a raw stage when the Promise object itself is the owned value"). That case keeps `fromFactory(create, { acquisitionMode: 'raw' })`, and every message and doc says so.

### Decision 3: overload shape

Both helpers have the two overloads `fromFactory` has, in the same order (contextual first, plain last), with `ContextualFactory<F>` for the contextual one:

```ts
fromSyncFactory<F extends ContextFactory>(callback: F & SyncOutput<ReturnType<NoInfer<F>>>, options: { readonly context: 'acquisition'; readonly acquisitionMode?: never })
fromSyncFactory<F extends Factory>(callback: F & SyncOutput<ReturnType<NoInfer<F>>>, options?: { readonly context?: never; readonly acquisitionMode?: never })
fromAsyncFactory<F extends (this: void, deps: never, factoryCtx: AcquisitionContext) => Promise<unknown>>(callback: F, options: { readonly context: 'acquisition'; readonly acquisitionMode?: never })
fromAsyncFactory<F extends Factory>(callback: F & AsyncOutput<ReturnType<NoInfer<F>>>, options?: { readonly context?: never; readonly acquisitionMode?: never })
```

The contextual `fromAsyncFactory` overload puts `Promise<unknown>` in the constraint rather than intersecting `AsyncOutput` onto the callback. The prototype showed why: on a context-sensitive callback (an untyped `factoryCtx` parameter) `[ReturnType<NoInfer<F>>] extends [Promise<unknown>]` is evaluated before the return type is known and rejects a genuine `async` callback, while the distributive `SyncOutput` defers correctly. This mirrors the existing `fromFactory` contextual overload, whose Promise requirement is also in the constraint. The message for a non-Promise contextual callback still contains `fromAsyncFactory requires a Promise output`, because both compilers print the plain overload's parameter type.

`acquisitionMode?: never` on both option types rejects the option even through a spread (`{ context: 'acquisition', ...{ acquisitionMode: 'raw' } }`); at runtime an `acquisitionMode` key throws `DI_BAG_INVALID_FACTORY`, as does a non-object options value or a `context` other than `'acquisition'`. A single-signature design with a conditional return type was rejected: without the `context: 'acquisition'` opt-in, an untyped second parameter would be contextually typed as `AcquisitionContext` and be `undefined` at runtime.

`SyncOutput` and `AsyncOutput` are not exported from `src/index.ts`, like `NativeOutput` and `AutoOutput`; they are reachable through `typeof fromSyncFactory` in emitted declarations.

### Decision 4: thenables and cross-realm Promises (documented behaviour)

- `fromSyncFactory`: never reads `then`. A thenable is rejected at compile time; through a cast, it is exposed unchanged as the service (`raw`).
- `fromAsyncFactory`: the runtime check is the engine's own, `Promise.prototype.then.call(value, …)` (`src/provider-execution.ts` `observePromise`), which succeeds exactly when the value has the Promise internal slot. A Promise from another realm (`node:vm` context, an iframe) and a `Promise` subclass are therefore observed like any native Promise, and an own `then` override on the instance is never called. A value that is not a native Promise, reachable only through a cast, fails that acquisition with the engine's `TypeError` (`|this| is not a Promise` on JavaScriptCore, `Method Promise.prototype.then called on incompatible receiver` on V8); its `then` is never called. No `DI_BAG_*` code is introduced for this: the type is the guard, the runtime behaviour is the existing `nativePromise` behaviour, and it is now written down in the tutorial and the errors page.

### Decision 5: `DI_BAG_CLASSIFIER_REQUIRED` names the bindings

`BindingGraph.preflight` keeps scanning after the first automatic binding when the host has no classifier, collects `description.label` of every binding whose source or direct-transform stage is `auto`, and throws once with the labels sorted (the binding map's iteration order is not insertion order), the first eight in the message and all of them in frozen `details.bindings`. The message keeps its `this host has no process.getBuiltinModule` prefix (five tests match on it) and becomes:

`this host has no process.getBuiltinModule; 2 registrations use automatic acquisition: "billing/hidden", "plain"; use DiBag.fromSyncFactory or DiBag.fromAsyncFactory (or an explicit acquisitionMode) for each, or configure DiBag.withConfiguration({ runtime: { isNativePromise } })`

(`1 registration uses …` in the singular; `…, "s07", and 4 more;` past eight.) Private module bindings carry their `<label>/<key>` label, so the message points at the module. The host is still consulted once, at the first automatic binding, and the scan returns immediately when it answers; only the failure path pays for the full list. `requireClassifier` splits into `resolveClassifier(context): RuntimeContext | undefined` and `classifierRequired(bindings): Error`. Two tests pin the full text (`tests/acquisition-mode.test.ts`, `tests/runtime-diagnostics.test.ts`) and change with it.

### Decision 6: what stays automatic

The plain-function shorthand in `register({ a: () => 1 })` stays `auto`, as do `fromFunction`, `fromClass` and direct `transformService` without an option. Changing any default would change the meaning of existing lines. The portable recipe uses the helpers for every named registration and the `acquisitionMode` option on those three; the error from Decision 5 lists whatever was missed.

### Decision 7: where the code lives

`fromSyncFactory` and `fromAsyncFactory` sit next to `fromFactory` in `src/acquisition-context.ts`, which owns the module-private `ContextFactory` type and `ContextualFactory`. The three share one private `factoryProvider(callback, mode, contextual)` that builds the provider; the public functions keep their own validation and error messages (`fromFactory requires a function` is unchanged). `SyncOutput`/`AsyncOutput` sit next to `NativeOutput`/`AutoOutput` in `src/acquisition-mode.ts`, which needs `IsAny` exported from `src/types.ts`. The facade (`DiBagApi` in `src/di-bag.ts`) gains the two members directly after `fromFactory`, with JSDoc `@throws` and `@example` because the API card is generated from them.

### Decision 8: documentation

- New compile-time family `### Portable factory output {#portable-factory-output}` in `docs/agent/errors.md`; the `DI_BAG_CLASSIFIER_REQUIRED` and `DI_BAG_INVALID_FACTORY` entries are rewritten.
- The tutorial's "Portable mode" section leads with the helpers, documents the thenable/cross-realm behaviour (Decision 4), and keeps the classifier strategy second. Its standalone example is the same graph as the first runtime test of Task 2.
- The server guide's portable `application.ts` uses the helpers; its troubleshooting row says the error names the registrations.
- A new recipe `## Make a graph portable to browsers and workers {#portable-graph}` in `docs/agent/recipes.md` (type-checked by `docs:check`), linked from AGENTS.md rule 1, which is rewritten in its existing five lines (the budget is full, so the recipe is not added to the bottom list; rule 6 links `#partial-acquisition` the same way).
- `tools/docs/api-card-tasks.json` gains two task rows; `docs/guides/api-reference.md` gains two facade rows; the README's portable paragraph is updated.
- `docs/reference/**` and `api-coverage.json` are regenerated. No CHANGELOG edit; the block is in Task 6.

### Decision 9: the one native diagnostic gap

Native tsc prints only the last overload's error. For `fromSyncFactory(async (_deps: {}, _factoryCtx) => 1, { context: 'acquisition' })` the last (plain) overload fails on arity, so the `SyncOutput` message appears only under tsc6. The fixture declares `// diagnostic-native-gap: last-contextual-sync-factory-promise` with the exact native text recorded in Task 1, the mechanism `structural-thenable.ts` already uses for its contextual case. Every other negative case prints a common substring under both compilers.

### Decision 10: tests and evidence

- `tests/portable-factories.test.ts` (fast lane) builds helper-only graphs under `withoutBuiltinModule` (`tests/host-builtin-module.ts`), which removes `process.getBuiltinModule` the way a browser lacks it.
- `tests/types/portable-factories.ts` + `-consumer.ts` (positive, and declaration consumption) and `tests/types/negative/portable-factories.ts` (rejections), checked by tsc6 in `tests/types.test.ts` and by native tsc in `npm run check:native`.
- `tests/platform/portable/contract.ts`, the fixture the Deno lane runs in a real Deno process and the browser lane runs in a real Chromium Worker from the packed archive, switches its synchronous registrations to `fromSyncFactory`, keeps one `fromFactory(…, { acquisitionMode: 'raw' })` Promise-as-service registration as evidence that the old form still works, and adds one `fromAsyncFactory` service with `withDisposal`. Three result fields are added and the expected result is updated in its three copies.

---

## File structure

| File | Responsibility in this plan |
| --- | --- |
| `src/acquisition-mode.ts` | `SyncOutput`, `AsyncOutput`; `resolveClassifier`, `classifierRequired` (replace `requireClassifier`) |
| `src/acquisition-context.ts` | `fromSyncFactory`, `fromAsyncFactory`, private `factoryProvider` and `portableContext` |
| `src/types.ts` | export `IsAny` |
| `src/di-bag.ts` | `DiBagApi` members and facade object; facade JSDoc |
| `src/runtime.ts` | `preflight` collects automatic labels |
| `tests/types/portable-factories.ts`, `tests/types/portable-factories-consumer.ts`, `tests/types/negative/portable-factories.ts` | type fixtures |
| `tests/types.test.ts`, `tests/native-diagnostic-markers.ts` | fixture wiring, native gap fingerprint |
| `tests/portable-factories.test.ts` | runtime behaviour |
| `tests/acquisition-mode.test.ts`, `tests/runtime-diagnostics.test.ts` | classifier error text and details |
| `tests/platform/portable/contract.ts`, `tests/platform-deno.test.ts`, `tests/platform/browser-worker.test.ts`, `scripts/platform-evidence.ts` | platform evidence fixture and its expected result |
| `docs/agent/errors.md`, `docs/agent/recipes.md`, `AGENTS.md`, `tools/docs/api-card-tasks.json` | agent docs (shipped in the package) |
| `docs/guides/tutorial.md`, `docs/guides/server-integration.md`, `docs/guides/api-reference.md`, `README.md` | guides |
| `docs/reference/**`, `docs/reference/api-coverage.json` | generated |

---

### Task 1: The helpers and their type fixtures

**Files:**
- Modify: `src/types.ts:59` (`type IsAny` → `export type IsAny`)
- Modify: `src/acquisition-mode.ts:3` (import) and after `AutoOutput` (line 40)
- Modify: `src/acquisition-context.ts:7` (import), `:79-88` (`fromFactory` body), append the helpers
- Modify: `src/di-bag.ts:19` (import), `:629` (after `fromFactory: typeof fromFactory;`), `:776` (facade object), `:781-784` (facade doc)
- Create: `tests/types/portable-factories.ts`, `tests/types/portable-factories-consumer.ts`, `tests/types/negative/portable-factories.ts`
- Modify: `tests/types.test.ts:58` (declaration-consumption list), `tests/native-diagnostic-markers.ts:5-10` (gap table)

**Interfaces:**
- Produces: `DiBag.fromSyncFactory` and `DiBag.fromAsyncFactory` with the overloads of Design Decision 3, on `DiBagApi` and therefore on `di-bag/node` too.
- Produces: `export type SyncOutput<O>`, `export type AsyncOutput<O>` in `src/acquisition-mode.ts` (module-internal, not re-exported from the index).
- Produces: `export type IsAny<T>` in `src/types.ts`.

- [ ] **Step 1: Write the positive fixture**

```ts
// tests/types/portable-factories.ts
import { DiBag } from '../../src';
import type { ProviderAcquiredValue, ProviderNamedDependencies, ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

type Config = { readonly url: string };
type Db = { query(): Promise<string[]>; end(): Promise<void> };
export const config = DiBag.fromSyncFactory((): Config => ({ url: 'memory:' }));
export const dbSource = DiBag.fromAsyncFactory(async ({ config }: { config: Config }): Promise<Db> => ({ query: async () => [config.url], end: async () => {} }));
export const db = DiBag.withDisposal(dbSource, db => db.end());
export const contextualSync = DiBag.fromSyncFactory((deps: { config: Config }, factoryCtx) => {
  factoryCtx.pushDisposer(() => {});
  return { url: deps.config.url, signal: factoryCtx.signal };
}, { context: 'acquisition' });
export const contextualAsync = DiBag.fromAsyncFactory(async (_deps: {}, factoryCtx) => ({ signal: factoryCtx.signal }), { context: 'acquisition' });
export const anyOutput = DiBag.fromSyncFactory((): any => 1);
export const unknownOutput = DiBag.fromSyncFactory((): unknown => 1);
// A function-valued service is not a thenable, even when it returns a Promise.
export const callable = DiBag.fromSyncFactory(() => async () => 1);
export const optionalObject = DiBag.fromSyncFactory((): { id: number } | undefined => undefined);
class ServicePromise<T> extends Promise<T> {}
export const subclass = DiBag.fromAsyncFactory(() => ServicePromise.resolve(1 as const));
export const projected = DiBag.transformService(config, { mode: 'direct', transform: value => value.url, acquisitionMode: 'raw' });
export const feature = DiBag.createBuilder().register({ config, db }).buildModule(['db'], { label: 'storage' });
export const bag = DiBag.createBuilder().installModule(feature).register({ config, contextualSync, contextualAsync, projected }).build();
export const resolved: Promise<Db> = bag.resolve('db');
export type Checks = [
  Assert<Equal<ProviderOutput<typeof config>, Config>>,
  Assert<Equal<ProviderAcquiredValue<typeof config>, Config>>,
  Assert<Equal<ProviderOutput<typeof dbSource>, Promise<Db>>>,
  Assert<Equal<ProviderAcquiredValue<typeof dbSource>, Db>>,
  Assert<Equal<ProviderAcquiredValue<typeof db>, Db>>,
  Assert<Equal<ProviderNamedDependencies<typeof dbSource>, { config: Config }>>,
  Assert<Equal<ProviderNamedDependencies<typeof contextualSync>, { config: Config }>>,
  Assert<Equal<ProviderOutput<typeof contextualSync>, { url: string; signal: AbortSignal }>>,
  Assert<Equal<ProviderOutput<typeof contextualAsync>, Promise<{ signal: AbortSignal }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof contextualAsync>, { signal: AbortSignal }>>,
  Assert<Equal<ProviderAcquiredValue<typeof subclass>, 1>>,
  Assert<Equal<ProviderOutput<typeof projected>, string>>,
];
```

```ts
// tests/types/portable-factories-consumer.ts
import { config, dbSource, db, contextualSync, contextualAsync, subclass, bag } from './portable-factories';
import type { ProviderAcquiredValue, ProviderNamedDependencies, ProviderOutput } from '../../src';
import type { Assert, Equal } from './assert';

type Config = { readonly url: string };
type Db = { query(): Promise<string[]>; end(): Promise<void> };
export const pending = bag.resolve('db');
export type Contracts = [
  Assert<Equal<ProviderOutput<typeof config>, Config>>,
  Assert<Equal<ProviderAcquiredValue<typeof db>, Db>>,
  Assert<Equal<ProviderNamedDependencies<typeof dbSource>, { config: Config }>>,
  Assert<Equal<ProviderNamedDependencies<typeof contextualSync>, { config: Config }>>,
  Assert<Equal<ProviderOutput<typeof contextualAsync>, Promise<{ signal: AbortSignal }>>>,
  Assert<Equal<ProviderAcquiredValue<typeof subclass>, 1>>,
  Assert<Equal<typeof pending, Promise<Db>>>,
  Assert<Equal<0 extends (1 & typeof pending) ? true : false, false>>,
];
```

In `tests/types.test.ts:58` add `'portable-factories'` to the array in `for (const fixture of ['lifetimes', 'composition-adapters', …])`.

- [ ] **Step 2: Write the negative fixture**

```ts
// tests/types/negative/portable-factories.ts
import { DiBag } from '../../../src';
import type { AcquisitionContext } from '../../../src';
class QueryBuilder { then(onFulfilled: (rows: number[]) => void) { onFulfilled([]); } }
// diagnostic: fromSyncFactory output must not be a Promise or thenable; use fromAsyncFactory for a Promise, or fromFactory with acquisitionMode raw to make the Promise object the service; see https://dany-fedorov.github.io/di-bag/agent/errors.html#portable-factory-output
DiBag.fromSyncFactory(async () => 1);
// diagnostic: fromSyncFactory output must not be a Promise or thenable
DiBag.fromSyncFactory(() => Promise.resolve(1));
// diagnostic: fromSyncFactory output must not be a Promise or thenable
DiBag.fromSyncFactory((): number | Promise<number> => 1);
// diagnostic: fromSyncFactory output must not be a Promise or thenable
DiBag.fromSyncFactory(() => new QueryBuilder());
// diagnostic: fromSyncFactory output must not be a Promise or thenable
// diagnostic-native-gap: last-contextual-sync-factory-promise
DiBag.fromSyncFactory(async (_deps: {}, _factoryCtx) => 1, { context: 'acquisition' });
// diagnostic: fromAsyncFactory requires a Promise output; use fromSyncFactory for a synchronous value; see https://dany-fedorov.github.io/di-bag/agent/errors.html#portable-factory-output
DiBag.fromAsyncFactory(() => 1);
// diagnostic: fromAsyncFactory requires a Promise output
DiBag.fromAsyncFactory((): number | Promise<number> => 1);
declare const promiseLike: PromiseLike<number>;
// diagnostic: fromAsyncFactory requires a Promise output
DiBag.fromAsyncFactory(() => promiseLike);
// diagnostic: fromAsyncFactory requires a Promise output
DiBag.fromAsyncFactory((_deps: {}, _factoryCtx: AcquisitionContext) => 1, { context: 'acquisition' });
// diagnostic: not assignable
DiBag.fromSyncFactory(() => 1, { acquisitionMode: 'raw' });
// diagnostic: not assignable
DiBag.fromAsyncFactory(async () => 1, { acquisitionMode: 'nativePromise' });
// diagnostic: not assignable
DiBag.fromSyncFactory(() => 1, { context: 'acquisition', ...{ acquisitionMode: 'raw' } });
// diagnostic: not assignable
DiBag.fromSyncFactory(function (this: { id: number }) { return this.id; });
// diagnostic: Target signature provides too few arguments
DiBag.fromSyncFactory((_deps: {}, _factoryCtx: AcquisitionContext, extra: number) => extra, { context: 'acquisition' });
// diagnostic: not assignable
DiBag.fromSyncFactory(() => 1, { context: 'later' });
```

The `_factoryCtx: AcquisitionContext` annotation on the contextual `fromAsyncFactory` line is load-bearing: without it native tsc adds a TS7006 implicit-`any` diagnostic that neither compiler's markers account for (the contextual overload's constraint fails on the return type, so the plain overload supplies no contextual type). The contextual `fromSyncFactory` line stays unannotated so its printed type matches the native fingerprint below.

Add the fingerprint to `nativeDiagnosticGapMessages` in `tests/native-diagnostic-markers.ts` (recorded from native 7.0.2 on the prototype; Step 7 confirms it):

```ts
  "last-contextual-sync-factory-promise": "No overload matches this call.\n  The last overload gave the following error.\n    Argument of type '(this: void, _deps: {}, _factoryCtx: AcquisitionContext) => Promise<number>' is not assignable to parameter of type 'Factory'.\n      Target signature provides too few arguments. Expected 2 or more, but got 1.",
```

- [ ] **Step 3: Run the type checks to verify they fail**

Run: `npm run typecheck`
Expected: errors in `tests/types/portable-factories.ts`: `Property 'fromSyncFactory' does not exist on type 'DiBagApi'`.

Run: `bun test tests/types.test.ts -t "portable-factories"`
Expected: FAIL for `type rejection: portable-factories.ts` (every marker missing; the only diagnostics are "does not exist") and for `portable-factories inferred exports survive declaration consumption`.

- [ ] **Step 4: Add the output guards**

`src/types.ts:59`: change `type IsAny<T> = 0 extends 1 & T ? true : false;` to `export type IsAny<T> = 0 extends 1 & T ? true : false;`.

`src/acquisition-mode.ts:3`: `import type { IsAny, SeeErrors, StructuralThenable, Unsatisfied } from './types';`. After `AutoOutput` (line 40) add:

```ts
type PromiseOutput<O> = O extends infer T & {} ? T extends Promise<unknown> ? true : false : false;
/** Reject a Promise or thenable output where the helper declares the stage synchronous; `any` is exempt. */
export type SyncOutput<O> = IsAny<O> extends true ? unknown
  : true extends PromiseOutput<O> | StructuralThenable<O>
    ? Unsatisfied<`fromSyncFactory output must not be a Promise or thenable; use fromAsyncFactory for a Promise, or fromFactory with acquisitionMode raw to make the Promise object the service${SeeErrors<'portable-factory-output'>}`, {}>
    : unknown;
/** Require a Promise output where the helper declares the stage asynchronous. */
export type AsyncOutput<O> = [O] extends [Promise<unknown>] ? unknown
  : Unsatisfied<`fromAsyncFactory requires a Promise output; use fromSyncFactory for a synchronous value${SeeErrors<'portable-factory-output'>}`, {}>;
```

- [ ] **Step 5: Add the helpers**

`src/acquisition-context.ts:7` becomes:

```ts
import type { Acquired, AcquisitionMode, AsyncOutput, AutoOutput, NativeOutput, ModeOptions, SyncOutput } from './acquisition-mode';
```

Replace the `fromFactory` implementation (lines 79–88) with:

```ts
export function fromFactory(callback: Factory | ContextFactory, options?: { readonly context?: 'acquisition'; readonly acquisitionMode?: AcquisitionMode }): ProviderBase {
  if (typeof callback !== 'function') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromFactory requires a function', { operation: 'fromFactory' });
  const mode = acquisitionMode(options);
  if (options?.context !== undefined && options.context !== 'acquisition') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromFactory context must be acquisition', { operation: 'fromFactory' });
  return factoryProvider(callback, mode, options?.context === 'acquisition');
}

/** Build the provider for one validated factory; `fromFactory` and both portable helpers end here. */
function factoryProvider(callback: Factory | ContextFactory, mode: AcquisitionMode, contextual: boolean): ProviderBase {
  const handle = createProvider<Factory, Readonly<{}>, readonly [], TokenDependencyContract, unknown>();
  const create: Factory = contextual ? ((deps: never, factoryCtx?: AcquisitionContext) => (callback as ContextFactory)(deps, factoryCtx!)) : callback as Factory;
  retainDescription(handle, sourceDescription(create, undefined, [], mode, contextual));
  return handle;
}

type PortableFactoryOptions = { readonly context?: never; readonly acquisitionMode?: never };
type ContextualPortableFactoryOptions = { readonly context: 'acquisition'; readonly acquisitionMode?: never };

/** Validate a portable helper's options; the mode is the helper's, so `acquisitionMode` is refused. */
function portableContext(operation: 'fromSyncFactory' | 'fromAsyncFactory', options: unknown): boolean {
  if (options === undefined) return false;
  if (typeof options !== 'object' || options === null) throw libraryError('DI_BAG_INVALID_FACTORY', `${operation} options must be an object`, { operation });
  if ('acquisitionMode' in options) throw libraryError('DI_BAG_INVALID_FACTORY', `${operation} selects its acquisitionMode itself`, { operation });
  const context: unknown = (options as { readonly context?: unknown }).context;
  if (context !== undefined && context !== 'acquisition') throw libraryError('DI_BAG_INVALID_FACTORY', `${operation} context must be acquisition`, { operation });
  return context === 'acquisition';
}

/**
 * Describe a synchronous named-dependency factory that runs on every host: a `raw` stage whose
 * exact return value is the service, so `then` is never read and no Promise classifier is needed.
 * @param callback - A receiver-free factory taking its named dependency object and the acquisition context.
 * @param options - `context: 'acquisition'`; the acquisition mode is fixed and `acquisitionMode` is rejected.
 * @returns A lazy provider preserving exact output and named dependencies; adds no ownership.
 * @typeParam F - The complete callback signature, retaining dependency and output inference.
 */
export function fromSyncFactory<F extends ContextFactory>(
  callback: F & SyncOutput<ReturnType<NoInfer<F>>>,
  options: ContextualPortableFactoryOptions,
): Provider<ContextualFactory<F>, Readonly<{}>, readonly [], TokenDependencyContract, ReturnType<F>>;
/**
 * Describe a synchronous named-dependency factory that runs on every host: a `raw` stage whose
 * exact return value is the service. A Promise or thenable output is rejected at compile time;
 * use `fromAsyncFactory`, or `fromFactory` with `acquisitionMode: 'raw'` when the Promise object is the service.
 * @param callback - A receiver-free factory taking its named dependency object.
 * @param options - Optional; `acquisitionMode` is rejected because the helper fixes it.
 * @returns A lazy provider retaining exact output and dependency types without adding ownership.
 * @typeParam F - The exact factory signature and exposed result.
 */
export function fromSyncFactory<F extends Factory>(
  callback: F & SyncOutput<ReturnType<NoInfer<F>>>,
  options?: PortableFactoryOptions,
): Provider<F, Readonly<{}>, readonly [], TokenDependencyContract, ReturnType<F>>;
export function fromSyncFactory(callback: Factory | ContextFactory, options?: { readonly context?: 'acquisition' }): ProviderBase {
  if (typeof callback !== 'function') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromSyncFactory requires a function', { operation: 'fromSyncFactory' });
  return factoryProvider(callback, 'raw', portableContext('fromSyncFactory', options));
}

/**
 * Describe an asynchronous named-dependency factory that runs on every host: a `nativePromise`
 * stage whose service is the returned Promise and whose owners receive the fulfilled value.
 * @param callback - A receiver-free async factory taking its named dependency object and the acquisition context.
 * @param options - `context: 'acquisition'`; the acquisition mode is fixed and `acquisitionMode` is rejected.
 * @returns A lazy provider exposing the factory's own Promise; adds no ownership.
 * @typeParam F - The complete callback signature, retaining dependency and output inference.
 */
export function fromAsyncFactory<F extends (this: void, deps: never, factoryCtx: AcquisitionContext) => Promise<unknown>>(
  callback: F,
  options: ContextualPortableFactoryOptions,
): Provider<ContextualFactory<F>, Readonly<{}>, readonly [], TokenDependencyContract, Awaited<ReturnType<F>>>;
/**
 * Describe an asynchronous named-dependency factory that runs on every host: a `nativePromise`
 * stage whose service is the returned Promise and whose owners receive the fulfilled value.
 * A non-Promise output is rejected at compile time; a thenable that is not a native Promise fails the acquisition with a `TypeError`.
 * @param callback - A receiver-free factory returning a native Promise.
 * @param options - Optional; `acquisitionMode` is rejected because the helper fixes it.
 * @returns A lazy provider exposing the factory's own Promise; `withDisposal` receives its fulfilled value.
 * @typeParam F - The exact factory signature and exposed Promise.
 */
export function fromAsyncFactory<F extends Factory>(
  callback: F & AsyncOutput<ReturnType<NoInfer<F>>>,
  options?: PortableFactoryOptions,
): Provider<F, Readonly<{}>, readonly [], TokenDependencyContract, Awaited<ReturnType<F>>>;
export function fromAsyncFactory(callback: Factory | ContextFactory, options?: { readonly context?: 'acquisition' }): ProviderBase {
  if (typeof callback !== 'function') throw libraryError('DI_BAG_INVALID_FACTORY', 'fromAsyncFactory requires a function', { operation: 'fromAsyncFactory' });
  return factoryProvider(callback, 'nativePromise', portableContext('fromAsyncFactory', options));
}
```

`src/di-bag.ts:19` → `import { fromFactory, fromSyncFactory, fromAsyncFactory } from './acquisition-context';`. In `DiBagApi`, directly after `fromFactory: typeof fromFactory;` (line 629) add:

```ts
  /**
   * Describe a synchronous factory that runs on every host: the exact return value is the service and `then` is never read.
   * A Promise or thenable output is rejected at compile time; use `fromAsyncFactory`, or `fromFactory` with `acquisitionMode: 'raw'` when the Promise object itself is the service.
   * @throws `DI_BAG_INVALID_FACTORY` for a non-function, an unknown `context`, or an `acquisitionMode` option.
   * @example
   * ```ts
   * const config = DiBag.fromSyncFactory(() => ({ url: 'memory:' }));
   * ```
   */
  fromSyncFactory: typeof fromSyncFactory;
  /**
   * Describe an asynchronous factory that runs on every host: the service is the returned native Promise and `withDisposal` receives its fulfilled value.
   * A non-Promise output is rejected at compile time; a thenable that is not a native Promise fails the acquisition with a `TypeError`.
   * @throws `DI_BAG_INVALID_FACTORY` for a non-function, an unknown `context`, or an `acquisitionMode` option.
   * @example
   * ```ts
   * const db = DiBag.withDisposal(
   *   DiBag.fromAsyncFactory(async ({ config }: { config: { url: string } }) => ({ url: config.url, end: async () => {} })),
   *   db => db.end(),
   * );
   * ```
   */
  fromAsyncFactory: typeof fromAsyncFactory;
```

In the facade object (line 776) change `fromFactory, token, optional, lazy, all, fromPlugin, fromFunction, fromClass,` to `fromFactory, fromSyncFactory, fromAsyncFactory, token, optional, lazy, all, fromPlugin, fromFunction, fromClass,`. Replace the facade doc (lines 781–784) with:

```ts
/**
 * The immutable DI Bag facade. `auto` acquisition uses the host classifier where `process.getBuiltinModule`
 * exists; elsewhere register with `fromSyncFactory` and `fromAsyncFactory`, use explicit modes, or configure a classifier.
 */
```

- [ ] **Step 6: Typecheck and run the fixture suites**

Run: `npm run typecheck && bun test tests/types.test.ts tests/type-scale.test.ts tests/token-scale.test.ts tests/api-renaming.test.ts`
Expected: PASS, including `type rejection: portable-factories.ts` and `portable-factories inferred exports survive declaration consumption`. If the negative test reports an `unexpected` diagnostic, its message is printed; it is almost certainly a marker substring that tsc6 prints differently (see Step 7) or a stray TS7006 from an unannotated `factoryCtx`.

- [ ] **Step 7: Verify the markers against both compilers**

Write `<scratchpad>/tsconfig.negative.json` (only `include` and `typeRoots` differ from the project's):

```json
{
  "compilerOptions": {
    "strict": true, "noEmit": true, "allowImportingTsExtensions": true, "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true, "module": "NodeNext", "target": "es2022", "moduleResolution": "NodeNext",
    "esModuleInterop": true, "skipLibCheck": true, "typeRoots": ["/home/df/wd/personal/di-bag/node_modules/@types"], "types": ["bun"]
  },
  "files": ["/home/df/wd/personal/di-bag/tests/types/negative/portable-factories.ts"]
}
```

Run:

```sh
for c in "npx tsc6" "npx tsc"; do echo "== $c"; $c -p <scratchpad>/tsconfig.negative.json 2>&1 | grep -c "TS7006"; $c -p <scratchpad>/tsconfig.negative.json 2>&1 | grep -A4 "negative/portable-factories.ts(13,"; done
```

Expected: `0` TS7006 for both; for line 13 tsc6 prints `Overload 1 of 2 … fromSyncFactory output must not be a Promise or thenable …` and native prints exactly the four lines of the `last-contextual-sync-factory-promise` fingerprint. If native's text differs (for example the argument type prints without `this: void`), copy the printed text verbatim into `nativeDiagnosticGapMessages`; the whole message must match. Then:

Run: `npm run check:native`
Expected: the JSON summary ends with `"status":"accepted-with-diagnostic-gaps"`, `failures: 0`, and `knownNativeRejections` one higher than before this task (there are four gaps today).

- [ ] **Step 8: Fast lane, retention, commit**

Run: `npm run test:fast` and `npm run build && node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs`
Expected: PASS (behaviour of `fromFactory` unchanged; 33 retention cases pass).

```bash
git add src/types.ts src/acquisition-mode.ts src/acquisition-context.ts src/di-bag.ts tests/types tests/types.test.ts tests/native-diagnostic-markers.ts
git commit -m "feat: add fromSyncFactory and fromAsyncFactory, portable factories with a fixed acquisition mode"
```

---

### Task 2: Runtime behaviour on a host without a classifier

**Files:**
- Create: `tests/portable-factories.test.ts` (fast lane: the file name is not in `scripts/test-lane.mjs` `compilerLane`)

**Interfaces:**
- Consumes: `DiBag.fromSyncFactory`, `DiBag.fromAsyncFactory` from Task 1; `withoutBuiltinModule` from `tests/host-builtin-module.ts`.

- [ ] **Step 1: Write the tests**

```ts
// tests/portable-factories.test.ts
import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { DiBag } from '../src';
import { withoutBuiltinModule } from './host-builtin-module';

type Config = { readonly url: string };
type Catalog = { names(): Promise<string[]>; close(): Promise<void> };

// The tutorial's "Portable mode" example; keep the two in step.
function portableApplication(log: string[]) {
  return DiBag.createBuilder()
    .register({
      config: DiBag.fromSyncFactory((): Config => ({ url: 'memory:' })),
      catalog: DiBag.withDisposal(
        DiBag.fromAsyncFactory(async ({ config }: { config: Config }): Promise<Catalog> => ({
          names: async () => [config.url],
          close: async () => { log.push('catalog.close'); },
        })),
        catalog => catalog.close(),
      ),
      handler: DiBag.fromSyncFactory(({ catalog }: { catalog: Promise<Catalog> }) => ({
        list: async () => (await catalog).names(),
      })),
    })
    .build();
}

test('the tutorial portable example builds and runs without process.getBuiltinModule', async () => {
  const log: string[] = [];
  const app = withoutBuiltinModule(() => portableApplication(log));
  expect(app.resolve('config')).toEqual({ url: 'memory:' });
  expect(app.resolve('catalog')).toBeInstanceOf(Promise);
  expect(await app.resolve('handler').list()).toEqual(['memory:']);
  await app.close();
  expect(log).toEqual(['catalog.close']);
});

test('modules, lifetimes, scopes, forks and direct transforms stay portable', async () => {
  const log: string[] = [];
  const feature = DiBag.createBuilder().register({
    hidden: DiBag.fromSyncFactory(() => 'hidden'),
    shown: DiBag.fromAsyncFactory(async ({ hidden }: { hidden: string }) => `${hidden}/shown`),
  }).buildModule(['shown'], { label: 'feature' });
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().installModule(feature).register({
    config: DiBag.withLifetime(DiBag.fromSyncFactory(() => ({ url: 'memory:' })), 'root'),
    db: DiBag.withLifetime(DiBag.withDisposal(DiBag.fromAsyncFactory(async ({ config }: { config: { url: string } }) => ({ url: config.url })), db => { log.push(`end:${db.url}`); }), 'root'),
    projected: DiBag.transformService(DiBag.fromSyncFactory(() => 1), { mode: 'direct', transform: value => value + 1, acquisitionMode: 'raw' }),
  }).build());
  const db = bag.resolve('db');
  expect((await db).url).toBe('memory:');
  expect(await bag.resolve('shown')).toBe('hidden/shown');
  expect(bag.resolve('projected')).toBe(2);
  const scope = bag.createScope();
  const fork = bag.fork();
  withoutBuiltinModule(() => {
    expect(scope.resolve('db')).toBe(db);
    expect(fork.resolve('config')).toEqual({ url: 'memory:' });
  });
  await scope.close();
  await fork.close();
  await bag.close();
  expect(log).toEqual(['end:memory:']);
});

test('fromSyncFactory exposes the exact value, never reads then, and is a raw stage', async () => {
  let reads = 0;
  const value: object = Object.defineProperty({}, 'then', { get() { reads++; throw new Error('never read'); } });
  const pending: object = Promise.resolve(7);
  const disposed: unknown[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().register({
    value: DiBag.fromSyncFactory((): object => value),
    // Reached only through a cast: the type rejects a Promise, the runtime is plain raw.
    promise: DiBag.withDisposal(DiBag.fromSyncFactory((): object => pending), resource => { disposed.push(resource); }),
    later: DiBag.fromAsyncFactory(async () => 1),
  }).build());
  expect(bag.resolve('value')).toBe(value);
  expect(bag.resolve('promise')).toBe(pending);
  expect(reads).toBe(0);
  const modes = new Map(bag.inspectGraph().bindings.map(binding => [binding.label, binding.acquisitionMode]));
  expect(modes.get('value')).toBe('raw');
  expect(modes.get('later')).toBe('nativePromise');
  await bag.close();
  expect(disposed).toEqual([pending]);
});

test('fromAsyncFactory exposes the Promise and hands its fulfilled value to the disposer', async () => {
  const pending = Promise.resolve({ id: 1 });
  const disposed: unknown[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().register({
    value: DiBag.withDisposal(DiBag.fromAsyncFactory(() => pending), resource => { disposed.push(resource); }),
  }).build());
  expect(bag.resolve('value')).toBe(pending);
  expect(bag.resolve('value')).toBe(pending);
  await bag.close();
  expect(disposed).toEqual([{ id: 1 }]);
});

for (const [name, make] of [
  ['a cross-realm Promise', () => runInNewContext('Promise.resolve({ id: 1 })') as Promise<{ id: number }>],
  ['a Promise subclass with an own then override', () => {
    class ServicePromise<T> extends Promise<T> {}
    const promise = ServicePromise.resolve({ id: 1 });
    promise.then = () => { throw new Error('own then must not run'); };
    return promise as Promise<{ id: number }>;
  }],
] as const) test(`fromAsyncFactory observes ${name} through the engine's own check`, async () => {
  const pending = make();
  const disposed: unknown[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().register({
    value: DiBag.withDisposal(DiBag.fromAsyncFactory(() => pending), resource => { disposed.push(resource); }),
  }).build());
  expect(bag.resolve('value')).toBe(pending);
  await bag.close();
  expect(disposed).toEqual([{ id: 1 }]);
});

test('fromAsyncFactory with a non-Promise fails that acquisition with a TypeError and never calls then', async () => {
  let thenCalls = 0;
  const thenable = { then() { thenCalls++; } };
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().register({
    thenable: DiBag.fromAsyncFactory(() => thenable as never),
    plain: DiBag.fromAsyncFactory(() => 7 as never),
  }).build());
  expect(() => bag.resolve('thenable')).toThrow(TypeError);
  expect(() => bag.resolve('plain')).toThrow(TypeError);
  expect(thenCalls).toBe(0);
  await bag.close();
});

test('the helpers reject invalid callbacks and options with DI_BAG_INVALID_FACTORY', () => {
  const sync = DiBag.fromSyncFactory as (...args: unknown[]) => unknown;
  const async = DiBag.fromAsyncFactory as (...args: unknown[]) => unknown;
  expect(() => sync(1)).toThrow('DI_BAG_INVALID_FACTORY: fromSyncFactory requires a function');
  expect(() => async(undefined)).toThrow('DI_BAG_INVALID_FACTORY: fromAsyncFactory requires a function');
  expect(() => sync(() => 1, null)).toThrow('DI_BAG_INVALID_FACTORY: fromSyncFactory options must be an object');
  expect(() => sync(() => 1, { acquisitionMode: 'raw' })).toThrow('DI_BAG_INVALID_FACTORY: fromSyncFactory selects its acquisitionMode itself');
  expect(() => async(async () => 1, { acquisitionMode: 'nativePromise' })).toThrow('DI_BAG_INVALID_FACTORY: fromAsyncFactory selects its acquisitionMode itself');
  expect(() => async(async () => 1, { context: 'later' })).toThrow('DI_BAG_INVALID_FACTORY: fromAsyncFactory context must be acquisition');
});

test('contextual helpers receive the signal and own pushed disposers', async () => {
  const events: string[] = [];
  const bag = withoutBuiltinModule(() => DiBag.createBuilder().register({
    sync: DiBag.fromSyncFactory((_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { events.push(`sync:${disposerCtx.reason}`); });
      return factoryCtx.signal.aborted;
    }, { context: 'acquisition' }),
    async: DiBag.fromAsyncFactory(async (_deps: {}, factoryCtx) => {
      factoryCtx.pushDisposer(disposerCtx => { events.push(`async:${disposerCtx.reason}`); });
      await Promise.resolve();
      return factoryCtx.signal.aborted;
    }, { context: 'acquisition' }),
  }).build());
  expect(bag.resolve('sync')).toBe(false);
  expect(await bag.resolve('async')).toBe(false);
  await bag.close();
  expect(events.sort()).toEqual(['async:no-service-disposer', 'sync:no-service-disposer']);
});
```

- [ ] **Step 2: Run the file**

Run: `bun test tests/portable-factories.test.ts`
Expected: PASS, 9 tests (all of this is Task 1 behaviour; the file pins it). If the `inspectGraph` assertions fail, the field is `acquisitionMode` on each `bindings` entry (`tests/inspect-graph.test.ts:20`); `bag.inspect(key)` does not carry it.

- [ ] **Step 3: Fast lane, commit**

Run: `npm run typecheck && npm run test:fast`
Expected: PASS.

```bash
git add tests/portable-factories.test.ts
git commit -m "test: pin portable factory semantics on a host without process.getBuiltinModule"
```

---

### Task 3: `DI_BAG_CLASSIFIER_REQUIRED` names every automatic registration

**Files:**
- Modify: `src/acquisition-mode.ts:63-69` (`requireClassifier`)
- Modify: `src/runtime.ts:11` (import), `:166-177` (`preflight`)
- Modify: `tests/acquisition-mode.test.ts:86-99` (the preflight test) and append
- Modify: `tests/runtime-diagnostics.test.ts:30-31`

**Interfaces:**
- Produces: `export function resolveClassifier(context: RuntimeContext): RuntimeContext | undefined` and `export function classifierRequired(bindings: readonly string[]): Error` in `src/acquisition-mode.ts`; `requireClassifier` is removed (its only caller is `preflight`).
- Produces: `details` of the error is `{ option: 'runtime.isNativePromise', bindings: readonly string[] }`, `bindings` sorted and frozen.

- [ ] **Step 1: Write the failing tests**

In `tests/acquisition-mode.test.ts`, add near the top (after the imports):

```ts
const caught = (run: () => unknown): { code?: string; message: string; details: Record<string, unknown> } => {
  try { run(); } catch (error) { return error as never; }
  throw new Error('expected a throw');
};
```

Replace the body of `'unconfigured core preflights every stage and private module before any factory effects'` (lines 87–99) so the loop reads:

```ts
  let calls = 0;
  const source = Core.fromFactory(() => { calls++; return 1; }, { acquisitionMode: 'raw' });
  const automatic = () => { calls++; return 2; };
  const feature = Core.createBuilder().register({ hidden: automatic, public: source }).buildModule(['public']);
  const cases: Array<[() => unknown, readonly string[]]> = [
    [() => Core.createBuilder().register({ source, automatic }).build(), ['automatic']],
    [() => Core.createBuilder().register({ projected: Core.transformService(source, { mode: 'direct', transform: value => { calls++; return value; } }) }).build(), ['projected']],
    [() => Core.createBuilder().installModule(feature).build(), ['hidden']],
  ];
  for (const [finalize, bindings] of cases) {
    const failure = caught(() => withoutBuiltinModule<unknown>(finalize));
    expect(failure.code).toBe('DI_BAG_CLASSIFIER_REQUIRED');
    expect(failure.details.bindings).toEqual(bindings);
  }
  expect(calls).toBe(0);
```

An unlabeled module's private binding keeps its key as its label (`buildModule` composes `<label>/<key>` only when `label` is given); if the third case prints a different label, copy it.

Append:

```ts
test('DI_BAG_CLASSIFIER_REQUIRED names every automatic registration, sorted, and suggests the helpers', () => {
  const raw = Core.fromFactory(() => 1, { acquisitionMode: 'raw' });
  const feature = Core.createBuilder().register({ hidden: () => 1, shown: ({ hidden }: { hidden: number }) => hidden }).buildModule(['shown'], { label: 'billing' });
  const failure = caught(() => withoutBuiltinModule(() => Core.createBuilder().installModule(feature).register({
    raw,
    plain: () => 2,
    projected: Core.transformService(raw, { mode: 'direct', transform: value => value }),
    sync: Core.fromSyncFactory(() => 3),
    pending: Core.fromAsyncFactory(async () => 4),
  }).build()));
  expect(failure.code).toBe('DI_BAG_CLASSIFIER_REQUIRED');
  expect(failure.details).toEqual({ option: 'runtime.isNativePromise', bindings: ['billing/hidden', 'plain', 'projected', 'shown'] });
  expect(Object.isFrozen(failure.details.bindings)).toBe(true);
  expect(failure.message).toBe('DI_BAG_CLASSIFIER_REQUIRED: this host has no process.getBuiltinModule; 4 registrations use automatic acquisition: "billing/hidden", "plain", "projected", "shown"; use DiBag.fromSyncFactory or DiBag.fromAsyncFactory (or an explicit acquisitionMode) for each, or configure DiBag.withConfiguration({ runtime: { isNativePromise } }); see https://dany-fedorov.github.io/di-bag/agent/errors.html#di-bag-classifier-required');
});

test('the classifier message lists at most eight registrations; details carry them all', () => {
  const registrations = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`s${String(index).padStart(2, '0')}`, () => index]));
  const failure = caught(() => withoutBuiltinModule(() => Core.createBuilder().register(registrations as never).build()));
  expect(failure.details.bindings).toHaveLength(12);
  expect(failure.message).toContain('12 registrations use automatic acquisition: "s00", "s01", "s02", "s03", "s04", "s05", "s06", "s07", and 4 more; use DiBag.fromSyncFactory');
});

test('a host classifier is consulted once, at the first automatic registration', async () => {
  let loads = 0;
  const counting = (id: string) => { loads++; return id === 'node:util/types' ? { isPromise } : undefined; };
  const bag = withoutBuiltinModule(() => Core.createBuilder().register({ a: () => 1, b: () => 2, c: () => 3 }).build(), counting);
  expect(loads).toBe(1);
  await bag.close();
});
```

In `tests/runtime-diagnostics.test.ts:31` replace the expected message with:

```ts
  expect(classifier.message).toBe(`DI_BAG_CLASSIFIER_REQUIRED: this host has no process.getBuiltinModule; 1 registration uses automatic acquisition: "value"; use DiBag.fromSyncFactory or DiBag.fromAsyncFactory (or an explicit acquisitionMode) for each, or configure DiBag.withConfiguration({ runtime: { isNativePromise } }); see ${page}#di-bag-classifier-required`);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/acquisition-mode.test.ts tests/runtime-diagnostics.test.ts`
Expected: the four classifier tests fail (`details.bindings` is `undefined`, the message has no registration list); everything else passes.

- [ ] **Step 3: Implement**

In `src/acquisition-mode.ts` replace `requireClassifier` (lines 63–69) with:

```ts
/** Resolve the classifier when a graph first needs one; a configured classifier always wins. */
export function resolveClassifier(context: RuntimeContext): RuntimeContext | undefined {
  if (context.isNativePromise) return context;
  const isNativePromise = hostClassifier();
  return isNativePromise ? Object.freeze({ ...context, isNativePromise }) : undefined;
}
const namedBindings = 8;
/** The graph has automatic stages and no classifier; `bindings` labels every such registration. */
export function classifierRequired(bindings: readonly string[]): Error {
  const sorted = [...bindings].sort();
  const shown = sorted.slice(0, namedBindings).map(label => JSON.stringify(label)).join(', ');
  const rest = sorted.length - Math.min(sorted.length, namedBindings);
  const count = sorted.length === 1 ? '1 registration uses' : `${sorted.length} registrations use`;
  return libraryError('DI_BAG_CLASSIFIER_REQUIRED', `this host has no process.getBuiltinModule; ${count} automatic acquisition: ${shown}${rest ? `, and ${rest} more` : ''}; use DiBag.fromSyncFactory or DiBag.fromAsyncFactory (or an explicit acquisitionMode) for each, or configure DiBag.withConfiguration({ runtime: { isNativePromise } })`, { option: 'runtime.isNativePromise', bindings: Object.freeze(sorted) });
}
```

In `src/runtime.ts:11` → `import { classifierRequired, resolveClassifier } from './acquisition-mode';` and replace `preflight` (lines 166–177) with:

```ts
  /**
   * Return the context acquisitions use, resolving the host classifier before any factory runs.
   * Immutable graphs need explicit-mode validation only once; configured forks are O(1).
   * A host without a classifier gets every automatic registration named, so the fix is one pass.
   */
  preflight(context: RuntimeContext): RuntimeContext {
    if (context.isNativePromise || this.#explicitlyClassified) return context;
    const automatic: string[] = [];
    for (const [, { description, normalized }] of this.#bindings) {
      if (normalized.acquisitionMode === 'auto' || normalized.operations.some(operation =>
        'acquisitionMode' in operation && operation.acquisitionMode === 'auto')) {
        // The host answers once for the whole graph; only a host without a classifier needs the full list.
        if (!automatic.length) { const resolved = resolveClassifier(context); if (resolved) return resolved; }
        automatic.push(description.label);
      }
    }
    if (automatic.length) throw classifierRequired(automatic);
    this.#explicitlyClassified = true;
    return context;
  }
```

- [ ] **Step 4: Run, retention, commit**

Run: `bun test tests/acquisition-mode.test.ts tests/runtime-diagnostics.test.ts tests/persistent-graph.test.ts tests/composition-adapters.test.ts tests/observers.test.ts tests/platform-deno.test.ts && npm run typecheck && npm run test:fast`
Expected: PASS (the five tests matching on the `this host has no process.getBuiltinModule` prefix are unaffected). Retention: `npm run build && node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs` → 33 pass (`runtime-scale` builds 1,000-binding graphs; the scan is unchanged on the success path).

```bash
git add src/acquisition-mode.ts src/runtime.ts tests/acquisition-mode.test.ts tests/runtime-diagnostics.test.ts
git commit -m "fix: name every automatic registration in DI_BAG_CLASSIFIER_REQUIRED"
```

---

### Task 4: The Deno and browser-Worker evidence lanes run the helpers

**Files:**
- Modify: `tests/platform/portable/contract.ts`
- Modify: `tests/platform-deno.test.ts:10-22`, `:47-60`
- Modify: `tests/platform/browser-worker.test.ts:76-87`
- Modify: `scripts/platform-evidence.ts:213-223`

`tests/platform/browser-entry.ts` and `tests/platform/deno-consumer.ts` are unchanged: they post `{ ...portableContract(DiBag), automatic }`.

- [ ] **Step 1: Update the expected results first**

In `tests/platform/portable/contract.ts` replace `PortableContractResult` and `PortableDiBag`:

```ts
export type PortableContractResult = {
  readonly aliasCanonical: true;
  readonly asyncDisposerValue: true;
  readonly asyncFulfilled: true;
  readonly asyncPromiseIdentity: true;
  readonly cleanupLog: readonly ['scoped', 'transient-2', 'transient-1', 'root'];
  readonly inspectionFrozen: true;
  readonly metadataFrozen: true;
  readonly rawDisposerIdentity: true;
  readonly rawPromiseIdentity: true;
  readonly rootOnce: true;
  readonly scopedOnce: true;
  readonly transientDistinct: true;
};

type PortableToken<T> = { readonly key: symbol; readonly __service?: T };

/** The smallest structural slice of the public root API used by this fixture. */
export type PortableDiBag = {
  createBuilder(): any;
  fromFactory(factory: (...dependencies: any[]) => unknown, options: { acquisitionMode: 'raw' }): any;
  fromSyncFactory(factory: (...dependencies: any[]) => unknown): any;
  fromAsyncFactory(factory: (...dependencies: any[]) => Promise<unknown>): any;
  token(key: symbol): { of<T>(): PortableToken<T> };
  withDisposal(factory: any, dispose: (value: any) => void | Promise<void>): any;
  withLifetime(factory: any, lifetime: 'root' | 'scoped' | 'transient'): any;
  withMetadata(factory: any, metadata: Readonly<Record<string, unknown>>): any;
};
```

(The duplicate `createBuilder(): any;` line goes.) In `tests/platform-deno.test.ts` add `asyncDisposerValue: true, asyncFulfilled: true, asyncPromiseIdentity: true,` to the `toEqual` object of `'portable root contract has host-independent semantics'` and, in `portableResult`, `asyncDisposerValue: true as const, asyncFulfilled: true as const, asyncPromiseIdentity: true as const,` between `aliasCanonical` and `cleanupLog`. The Deno evaluator compares canonical (key-sorted) JSON that the test builds by hand, so `denoResult` must keep sorted order:

```ts
const { aliasCanonical, asyncDisposerValue, asyncFulfilled, asyncPromiseIdentity, ...portableRest } = portableResult;
const denoResult = { aliasCanonical, asyncDisposerValue, asyncFulfilled, asyncPromiseIdentity, automatic: 'resolved' as const, ...portableRest };
```

In `tests/platform/browser-worker.test.ts` `portableResult` and in `scripts/platform-evidence.ts` `expectedPortableResult` add the same three `true` fields after `aliasCanonical` (the Worker comparison is structural; the script's Deno comparison sorts keys itself).

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `bun test tests/platform-deno.test.ts`
Expected: `'portable root contract has host-independent semantics'` fails (the three fields are missing from the result); `'Deno child validation …'` fails on `child result mismatch` for the clean transcript.

- [ ] **Step 3: Rewrite the fixture's registrations**

In `portableContract`, change the module line and the registrations to:

```ts
  const feature = DiBag.createBuilder().register({ helper: DiBag.fromSyncFactory(() => privateHelper) }).register(exported, DiBag.fromSyncFactory(({ helper }: { helper: typeof privateHelper }) => helper)).buildModule([exported]);

  let rootCalls = 0;
  let scopedCalls = 0;
  let transientCalls = 0;
  const rawPromise = Promise.resolve({ value: 'raw' });
  let rawDisposed: unknown;
  let asyncDisposed: { value: string } | undefined;
  const root = DiBag.createBuilder().installModule(feature).register({
    root: DiBag.withMetadata(DiBag.withLifetime(DiBag.withDisposal(
      DiBag.fromSyncFactory(() => ({ id: ++rootCalls })),
      () => { cleanupLog.push('root'); },
    ), 'root'), { static: { portable: true } }),
    scoped: DiBag.withDisposal(
      DiBag.fromSyncFactory(() => ({ id: ++scopedCalls })),
      () => { cleanupLog.push('scoped'); },
    ),
    transient: DiBag.withLifetime(DiBag.withDisposal(
      DiBag.fromSyncFactory(() => ({ id: ++transientCalls })),
      value => { cleanupLog.push(`transient-${value.id}`); },
    ), 'transient'),
    // The Promise object itself is the service: the explicit raw form stays the way to say so.
    raw: DiBag.withDisposal(
      DiBag.fromFactory(() => rawPromise, { acquisitionMode: 'raw' }),
      value => { rawDisposed = value; },
    ),
    pending: DiBag.withDisposal(
      DiBag.fromAsyncFactory(async () => ({ value: 'async' })),
      (value: { value: string }) => { asyncDisposed = value; },
    ),
  }).alias('rootAlias', 'root').build();
```

After `const rawValue = child.resolve('raw');` add:

```ts
  const pending1 = child.resolve('pending');
  const pending2 = child.resolve('pending');
  const asyncPromiseIdentity = pending1 === pending2 && pending1 instanceof Promise;
  const asyncFulfilled = (await pending1).value === 'async';
```

and to the returned object add (keys in this order, the object is not sorted by the fixture):

```ts
    asyncDisposerValue: (asyncDisposed !== undefined && asyncDisposed.value === 'async') as true,
    asyncFulfilled: asyncFulfilled as true,
    asyncPromiseIdentity: asyncPromiseIdentity as true,
```

- [ ] **Step 4: Run the platform unit tests**

Run: `npm run typecheck && bun test tests/platform-deno.test.ts tests/platform/browser-worker.test.ts tests/platform-evidence.test.ts`
Expected: PASS. `tests/platform-deno.test.ts` calls `portableContract(DiBag)` with the real facade, which is where `PortableDiBag`'s slice is checked against the overloaded helpers (validated on the prototype with both compilers). The browser test `'provisioned browser tools execute the real packed archive lane'` returns early when esbuild, Playwright or Chromium are not pinned.

- [ ] **Step 5: Run the real lanes**

Provision once per machine, from `docs/guides/development.md` (lines 63–71):

```sh
npm ci --prefix tools/platform --no-audit --no-fund
export PLAYWRIGHT_BROWSERS_PATH="$PWD/tools/platform/.browsers"
node tools/platform/node_modules/playwright/cli.js install chromium   # add --with-deps on a bare Linux host
npm run platform:pin -- --all
```

Run: `npm run check:platform`
Expected: three rows `archive`, `deno-root`, `browser-worker-minified`, all `pass`. The browser row is the acceptance criterion: the packed archive, bundled by esbuild for the browser with no `node:` inputs, runs the helpers in a real Chromium Worker where `process` does not exist, and `automatic` still reports `DI_BAG_CLASSIFIER_REQUIRED`. A `fail` with `Worker result mismatch` means the fixture and the three expected objects disagree; print `transcript.messages[0].result` from a scratch driver to see which field.

```bash
git add tests/platform/portable/contract.ts tests/platform-deno.test.ts tests/platform/browser-worker.test.ts scripts/platform-evidence.ts
git commit -m "test(platform): run the portable helpers in the Deno and browser-Worker lanes"
```

---

### Task 5: Documentation

**Files:**
- Modify: `docs/agent/errors.md` (insert a family after line 192; rewrite `:241-262` and `:703-722`)
- Modify: `docs/guides/tutorial.md:1188-1250` ("Portable mode")
- Modify: `docs/guides/server-integration.md:432-497`, `:684-686`, `:716`
- Modify: `docs/agent/recipes.md` (insert before `## Review a merge`, line 300)
- Modify: `AGENTS.md:13-17` (rule 1, exactly five lines; budget 150/150)
- Modify: `tools/docs/api-card-tasks.json`, `docs/guides/api-reference.md:45`, `README.md:226-230`
- Regenerate: `docs/reference/**`, `docs/reference/api-coverage.json`, `docs/agent/api-card.md`

- [ ] **Step 1: errors.md, the family**

Insert after the "Structural thenable" section (after line 192, before `### Wrong shape at a call`):

````markdown
### Portable factory output {#portable-factory-output}

**When:** `fromSyncFactory output must not be a Promise or thenable; use fromAsyncFactory for a Promise, or fromFactory with acquisitionMode raw to make the Promise object the service; see https://dany-fedorov.github.io/di-bag/agent/errors.html#portable-factory-output`,
or `fromAsyncFactory requires a Promise output; use fromSyncFactory for a synchronous value; see https://dany-fedorov.github.io/di-bag/agent/errors.html#portable-factory-output`.

**Cause:** the helper fixes the acquisition mode from its name, so the factory's
declared output must agree with it. `fromSyncFactory` is a `raw` stage that never
reads `then`: an `async` function, a `Promise`-returning function, a union with a
Promise member, or a thenable such as a query builder cannot be its service.
`fromAsyncFactory` is a `nativePromise` stage: a plain value, a union, or a
`PromiseLike` cannot be its service.

**Fix:** pick the helper that matches the output. When the Promise object itself
is the service, use `DiBag.fromFactory(create, { acquisitionMode: 'raw' })`.

```ts
// expect-error: fromSyncFactory output must not be a Promise or thenable
import { DiBag } from 'di-bag';

const config = DiBag.fromSyncFactory(async () => ({ url: 'memory:' }));
```

```ts
import { DiBag } from 'di-bag';

const config = DiBag.fromAsyncFactory(async () => ({ url: 'memory:' }));
const ownedPromise = DiBag.fromFactory(() => Promise.resolve({ url: 'memory:' }), { acquisitionMode: 'raw' });
```

**Recipe:** [make a graph portable to browsers and workers](recipes.md#portable-graph).

````

- [ ] **Step 2: errors.md, the two runtime entries**

Replace `### DI_BAG_CLASSIFIER_REQUIRED` (lines 241–262) with:

````markdown
### DI_BAG_CLASSIFIER_REQUIRED {#di-bag-classifier-required}

**When:** `build()` or `buildAndStart()` completes a graph on a host without
`process.getBuiltinModule`: browsers, Web Workers, and other non-Node runtimes.
Node, Bun, and Deno never raise it.

**Cause:** a registration uses automatic acquisition, no native-Promise classifier
is configured, and the host offers none. The message and `details.bindings` name
every such registration, sorted, with private module services as `<label>/<key>`;
a direct `transformService` without an `acquisitionMode` counts under its
registration's name.

**Fix:** register each named service with `DiBag.fromSyncFactory` or
`DiBag.fromAsyncFactory`; give `fromFunction`, `fromClass`, and direct
`transformService` an explicit `acquisitionMode`; or configure a trusted
classifier with `withConfiguration({ runtime: { isNativePromise } })`.

```ts
import { DiBag } from 'di-bag';

const app = DiBag.createBuilder()
  .register({
    answer: DiBag.fromSyncFactory(() => 42),
    later: DiBag.fromAsyncFactory(async ({ answer }: { answer: number }) => answer * 2),
  })
  .build();
```

**Recipe:** [make a graph portable to browsers and workers](recipes.md#portable-graph).
````

In `### DI_BAG_INVALID_FACTORY` (lines 703–722) replace the first three paragraphs with:

```markdown
**When:** `DiBag.fromFactory`, `fromSyncFactory`, or `fromAsyncFactory` receives a
non-function, or a `context` option other than `'acquisition'`; the two portable
helpers also refuse an `acquisitionMode` option, because they fix it themselves.

**Cause:** a value passed where a factory is expected, or a mode passed to a
helper whose name already selects it.

**Fix:** pass a function; use `{ context: 'acquisition' }` to receive the
acquisition context as the second argument; choose `fromSyncFactory` or
`fromAsyncFactory` instead of passing a mode to them.
```

- [ ] **Step 3: Tutorial "Portable mode"**

Replace lines 1188–1250 (the section up to, not including, `## Represent acquisition values and metadata natively`) with:

````markdown
## Portable mode

On Node, Bun, and Deno, `di-bag` classifies native Promises with the host's
`util.types.isPromise`, loaded through `process.getBuiltinModule` at the first
`build()` that needs it; `di-bag/node` configures the same classifier at import.
Browsers, workers, and other hosts have no `process.getBuiltinModule`, so there
`build()` throws `DI_BAG_CLASSIFIER_REQUIRED`, naming every registration that
still uses automatic acquisition.

The portable style says on each registration whether its factory is synchronous
or asynchronous, so no classifier is needed anywhere:

**Standalone example:**

```ts
import { DiBag } from 'di-bag';

type Config = { readonly url: string };
type Catalog = { names(): Promise<string[]>; close(): Promise<void> };

const app = DiBag.createBuilder()
  .register({
    config: DiBag.fromSyncFactory((): Config => ({ url: 'memory:' })),
    catalog: DiBag.withDisposal(
      DiBag.fromAsyncFactory(async ({ config }: { config: Config }): Promise<Catalog> => ({
        names: async () => [config.url],
        close: async () => {},
      })),
      catalog => catalog.close(),
    ),
    handler: DiBag.fromSyncFactory(({ catalog }: { catalog: Promise<Catalog> }) => ({
      list: async () => (await catalog).names(),
    })),
  })
  .build();

console.log(await app.resolve('handler').list()); // ['memory:']
await app.close();
```

`fromSyncFactory(create)` is a `raw` stage: the exact return value is the
service and `then` is never read. The compiler rejects an `async` function, a
`Promise`-returning function, a union with a Promise member, or a thenable such
as a query builder with `fromSyncFactory output must not be a Promise or thenable`.
`fromAsyncFactory(create)` is a `nativePromise` stage: the service is the
returned Promise, consumers declare and await it, and `withDisposal` receives
the fulfilled value. The compiler rejects a non-Promise output, a union, or a
`PromiseLike` with `fromAsyncFactory requires a Promise output`. Both accept
`{ context: 'acquisition' }` like `fromFactory`. Ownership, lifetimes, metadata,
modules, scopes, and forks are unchanged: the helpers only fix the mode that
`fromFactory(create, { acquisitionMode })` spells out.

Thenables and foreign Promises: `fromAsyncFactory` uses the engine's own check,
`Promise.prototype.then` called on the value, so a Promise from another realm or
a `Promise` subclass is observed like any native Promise, and an own `then`
override on the instance is never called. A value that is not a native Promise,
reachable only through a cast because the type is rejected, fails that
acquisition with the engine's `TypeError` and never has its `then` called. A
Promise object that is itself the service, or a thenable that is the service,
keeps `DiBag.fromFactory(create, { acquisitionMode: 'raw' })`.

Everything reachable must be explicit: private module services, overrides in
`fork` and `createScope`, and every direct `transformService`, `fromFunction`,
and `fromClass`, which take `acquisitionMode` as an option. Graph completion
checks the whole graph before any factory runs and lists what is still
automatic. The other portable strategy is a trusted application-local
classifier:

**Conceptual snippet:** `trustedHostPredicate` is supplied by the application.

```ts
import { DiBag as CoreDiBag } from 'di-bag';

const DiBag = CoreDiBag.withConfiguration({
  runtime: {
    isNativePromise: trustedHostPredicate,
  },
});
```

It must identify native Promises without using a structural thenable test or a
plain `instanceof` test. `withConfiguration()` returns a new facade; it does not mutate
global state. Its context follows builders, bags, scopes, and forks.

The stage rules are precise:

- `raw` exposes the exact return value without reading `then`.
- `nativePromise` requires a Promise-shaped TypeScript output, observes native
  fulfillment, and still exposes the exact source Promise.
- `fromSyncFactory` and `fromAsyncFactory` are `fromFactory` with `raw` and
  `nativePromise` fixed, plus a compile-time check that the output agrees.
- `auto` asks the configured predicate, or the host's `util.types.isPromise`
  when none is configured and the host exposes `process.getBuiltinModule`.
- `fromFactory`, `fromFunction`, and `fromClass` select their result stage's
  `acquisitionMode`; omission defaults to `auto`.
- `transformService` in `direct` mode independently selects its output acquisition
  mode, defaulting to `auto`. It can use `raw` to own a returned Promise itself.
- `transformService` and dynamic `withMetadata` in `awaited` mode introduce a
  native Promise stage. They expose a Promise even for a synchronous source.
- `withDisposal`, `withLifetime`, static-only metadata, direct dynamic metadata,
  token binding, aliases, and module installation retain source acquisition modes.

Automatic or native observation tracks fulfillment for ownership and readiness
without replacing the exposed Promise. A raw Promise is an immediate value. See
the [server guide's Deno section](server-integration.md#deno-and-portable-acquisition)
for a full portable-host composition.

````

The standalone example is the graph `tests/portable-factories.test.ts` builds under `withoutBuiltinModule`; change both or neither.

- [ ] **Step 4: Server guide**

Replace lines 432–497 (from "Hosts without `process.getBuiltinModule`" through the paragraph ending "[portable host configuration](tutorial.md#portable-mode).") with:

````markdown
Hosts without `process.getBuiltinModule`, such as browsers and workers, have no
automatic native-Promise predicate. There, say on **every factory stage**,
including overrides, whether it is synchronous or asynchronous:
`fromSyncFactory` for a value, `fromAsyncFactory` for a Promise. This portable
version of `application.ts` runs on every host, Deno included:

```ts
import { DiBag } from 'di-bag';

type RequestContext = { id: string };
type Catalog = Map<string, string>;

export function createApplication() {
  return DiBag.createBuilder()
    .register({
      catalog: DiBag.withLifetime(
        DiBag.withDisposal(
          DiBag.fromAsyncFactory(async () => new Map([['book', 'A good book']])),
          (catalog) => catalog.clear(),
        ),
        'root',
      ),
      request: DiBag.fromSyncFactory((): RequestContext => ({ id: 'outside-request' })),
      handler: DiBag.fromSyncFactory(
        ({ catalog, request }: { catalog: Promise<Catalog>; request: RequestContext }) => ({
          async list() {
            return {
              requestId: request.id,
              items: Array.from((await catalog).values()),
            };
          },
        }),
      ),
    })
    .buildAndStart(['catalog']);
}

export type Application = Awaited<ReturnType<typeof createApplication>>;

export function createRequestScope(app: Application, requestId: string) {
  return app.createScope(['request'], {
    request: DiBag.fromSyncFactory(() => ({ id: requestId })),
  });
}
```

Keep `owned-scope.ts` and `handle-request.ts` from the earlier sections.
`fromSyncFactory` preserves the exact value without inspecting `then`.
`fromAsyncFactory` tracks a genuine native promise and gives its fulfillment to
the disposer. Wrapping with `withDisposal`, `withLifetime`, static `withMetadata`,
or direct dynamic `withMetadata` preserves the chosen mode. `transformService`
in `direct` mode, `fromFunction`, and `fromClass` introduce stages of their own;
give them an explicit `acquisitionMode`. `transformService` and dynamic
`withMetadata` in `awaited` mode declare native acquisition. If `build()` still
throws `DI_BAG_CLASSIFIER_REQUIRED`, its message names the registrations that
are automatic. See [portable host configuration](tutorial.md#portable-mode).
````

Line 684–686: replace "Fixtures for hosts without `process.getBuiltinModule` also need explicit acquisition modes." with "Fixtures for hosts without `process.getBuiltinModule` also use `fromSyncFactory` or `fromAsyncFactory`." Line 716, the troubleshooting row, becomes:

```markdown
| `.build()` rejects with `DI_BAG_CLASSIFIER_REQUIRED` in a browser or worker | Its message and `details.bindings` name the automatic registrations; register each with `fromSyncFactory` or `fromAsyncFactory`, and give direct `transformService`, `fromFunction`, and `fromClass` an `acquisitionMode`. |
```

- [ ] **Step 5: Recipe** (insert before `## Review a merge {#review-merge}`; 58 lines including the trailing blank, budget is under 60)

````markdown
## Make a graph portable to browsers and workers {#portable-graph}

Hosts without `process.getBuiltinModule` cannot classify Promises, so every
registration says whether its factory is synchronous or asynchronous. The same
module then runs on Node, Bun, Deno, and in a browser Worker.

```ts
// src/features/search/contract.ts
export type Index = { lookup(term: string): Promise<string[]>; close(): Promise<void> };
export type IndexConfig = { url: string };
export type Search = { find(term: string): Promise<string[]> };
```

```ts
// src/features/search/module.ts
import { DiBag } from 'di-bag';
import type { Index, IndexConfig, Search } from './contract.js';

export const searchModule = DiBag.createBuilder()
  .register({
    index: DiBag.withLifetime(
      DiBag.withDisposal(
        DiBag.fromAsyncFactory(async ({ config }: { config: IndexConfig }): Promise<Index> => ({
          lookup: async term => [`${config.url}#${term}`],
          close: async () => {},
        })),
        index => index.close(),
      ),
      'root',
    ),
    search: DiBag.fromSyncFactory(({ index }: { index: Promise<Index> }): Search => ({
      find: async term => (await index).lookup(term),
    })),
  })
  .buildModule(['search'], { label: 'search' });
```

```ts
// src/features/search/check.ts
import { DiBag } from 'di-bag';
import type { IndexConfig } from './contract.js';
import { searchModule } from './module.js';

DiBag.createBuilder()
  .installModule(searchModule)
  .register({ config: DiBag.withLifetime(DiBag.fromSyncFactory((): IndexConfig => ({ url: 'memory:' })), 'root') })
  .verifyGraph() satisfies void;
```

`fromSyncFactory` is `fromFactory` with `acquisitionMode: 'raw'`: the exact value
is the service and `then` is never read; an `async` function or a thenable output
is rejected at compile time. `fromAsyncFactory` is `fromFactory` with
`acquisitionMode: 'nativePromise'`: the Promise is the service, consumers await it,
and `withDisposal` receives the fulfilled value. Give direct `transformService`,
`fromFunction`, and `fromClass` an explicit `acquisitionMode`. A leftover automatic
registration fails `build()` with [`DI_BAG_CLASSIFIER_REQUIRED`](errors.md#di-bag-classifier-required),
which names it; a Promise that is itself the service keeps `fromFactory(create, { acquisitionMode: 'raw' })`.

````

Verify: `awk '/^## Make a graph portable/{f=1} f&&/^## Review a merge/{exit} f' docs/agent/recipes.md | wc -l` → 58 or fewer. If it reaches 60, drop the sentence beginning "a Promise that is itself the service".

- [ ] **Step 6: AGENTS.md rule 1** (replace lines 13–17; five lines, no more)

```markdown
1. **Import from `di-bag`:** `import { DiBag } from 'di-bag';`. It configures
   itself on Node, Bun, and Deno; `di-bag/node` is the same API in explicit form.
   For browsers and workers register with `DiBag.fromSyncFactory` / `fromAsyncFactory`
   ([portable recipe](docs/agent/recipes.md#portable-graph)); a plain factory there fails
   `build()` with [`DI_BAG_CLASSIFIER_REQUIRED`](docs/agent/errors.md#di-bag-classifier-required), which names it.
```

Run: `wc -l AGENTS.md` → 150.

- [ ] **Step 7: Card tasks, API reference table, README**

`tools/docs/api-card-tasks.json`: after `{ "task": "Register a service", "call": "builder.register" },` add:

```json
  { "task": "Register a synchronous factory for a browser or worker", "call": "DiBag.fromSyncFactory" },
  { "task": "Register an async factory for a browser or worker", "call": "DiBag.fromAsyncFactory" },
```

`docs/guides/api-reference.md`, after the `fromFactory` row (line 45):

```markdown
| `fromSyncFactory(create, options?)` | `fromFactory` with `acquisitionMode: 'raw'` fixed and a Promise or thenable output rejected at compile time: the [portable](tutorial.md#portable-mode) synchronous form. |
| `fromAsyncFactory(create, options?)` | `fromFactory` with `acquisitionMode: 'nativePromise'` fixed and a non-Promise output rejected: the portable asynchronous form; `withDisposal` receives the fulfilled value. |
```

`README.md`: the paragraph beginning "On hosts without `process.getBuiltinModule` (browsers, workers), `build()`" (lines 226–230 at e1d4037; the working tree may have shifted it, search for the text) becomes:

```markdown
On hosts without `process.getBuiltinModule` (browsers, workers), `build()`
rejects automatic acquisition stages and names them. Register with
`DiBag.fromSyncFactory` / `DiBag.fromAsyncFactory` there, or configure a trusted
classifier. See [portable mode](docs/guides/tutorial.md#portable-mode).
```

- [ ] **Step 8: Regenerate and check**

Run: `npm run docs:generate && npm run docs:check`
Expected: `docs/agent/api-card.md` gains the two task rows and two `DiBag facade` entries directly after `DiBag.fromFactory` (about 354 lines; budget 400); `docs/reference/index/interfaces/DiBagApi.md` lists both members; `api-coverage.json` gains `index.DiBagApi.fromSyncFactory: 2`, `index.DiBagApi.fromAsyncFactory: 2` and the `node.` twins; `docs:check` prints that the agent docs are consistent. Failure modes: "missing family section #portable-factory-output" means the heading id in Step 1 is wrong; an `expect-error` mismatch means the fragment on the counterexample's first line is not a substring of the printed message; a recipe over budget is Step 5's last sentence.

```bash
git add docs AGENTS.md README.md tools/docs/api-card-tasks.json
git commit -m "docs: fromSyncFactory and fromAsyncFactory as the portable style; classifier error names its registrations"
```

---

### Task 6: Full gate, changelog block, PR text

- [ ] Run, in order: `npm run check` (with `npm_config_update_notifier=false` in the environment); the retention suites; `npm run typecheck:native`; `npm run build:native`; the retention suites again; `npm run check:native`; `npm run graph:check`; `npm run agent-eval:test`; `for f in examples/*.ts; do bun "$f" || exit 1; done`; `npm run check:platform` where the browser tools are provisioned (Task 4 Step 5), otherwise `bun test tests/platform-evidence.test.ts tests/platform-tools.test.ts tests/platform-deno.test.ts tests/platform/browser-worker.test.ts`.
- [ ] Expected: all green; `check:native` status `accepted-with-diagnostic-gaps` with five known gaps. `tests/package.test.ts` may time out under load; rerun `bun test tests/package.test.ts` alone before investigating.
- [ ] Confirm `git diff --stat feat/push-disposer` touches nothing outside `src/`, `tests/`, `scripts/platform-evidence.ts`, `docs/`, `AGENTS.md`, `README.md`, `tools/docs/api-card-tasks.json`, and that `CHANGELOG.md` is untouched.
- [ ] Changelog block for the next release chore (not committed now; `## Unreleased` is forbidden):

```md
### Added

- `DiBag.fromSyncFactory(create, options?)` and `DiBag.fromAsyncFactory(create, options?)`
  ([#28](https://github.com/dany-fedorov/di-bag/issues/28)): `fromFactory` with
  `acquisitionMode: 'raw'` and `'nativePromise'` fixed by name, so a graph built
  from them runs on hosts without `process.getBuiltinModule` (browsers, workers)
  with no classifier. The compiler rejects a Promise, a union with a Promise
  member, or a thenable output on `fromSyncFactory` and a non-Promise output on
  `fromAsyncFactory` (family `portable-factory-output`). Both accept
  `{ context: 'acquisition' }`; an `acquisitionMode` option is rejected at
  compile time and with `DI_BAG_INVALID_FACTORY` at runtime. A Promise that is
  itself the service keeps `fromFactory(create, { acquisitionMode: 'raw' })`.

### Changed

- `DI_BAG_CLASSIFIER_REQUIRED` now names every registration that still uses
  automatic acquisition, sorted: the first eight in the message, all of them in
  `details.bindings`, private module services as `<label>/<key>`. The message
  suggests the two helpers. Code matching the full message text must match the
  new text; the `this host has no process.getBuiltinModule` prefix, `code`, and
  `details.option` are unchanged.
```

- [ ] PR body: the two changelog paragraphs, "Closes #28", the acceptance list from the issue with where each is proven (browser and Bun: `check:platform` browser row and `tests/portable-factories.test.ts`; sync stays sync / async stays Promise-valued: `tests/portable-factories.test.ts` and the contract fixture's `asyncPromiseIdentity`; type fixtures: `tests/types/negative/portable-factories.ts` under both compilers; thenables and cross-realm: tutorial "Portable mode" and the two `fromAsyncFactory observes …` tests; ownership, inference, modules, disposal: the positive fixture and the modules/scopes/forks test; `fromFactory` unchanged: the contract fixture's `raw` registration; recipe: `docs/agent/recipes.md#portable-graph`, type-checked by `docs:check`), and the verification line in the style of 2e6602f.

---

## Risks

1. **Negative fixture markers** (Task 1 Step 7). The native fingerprint was recorded on 7.0.2 from the prototype; a different native build may print the argument type without `this: void`. The plan says to copy the printed text. Highest-probability stall.
2. **Overload order.** The contextual overload must stay first and the plain overload last, as in `fromFactory`; swapping them changes which overload native tsc reports and invalidates the fingerprint and several `not assignable` markers.
3. **The contextual `fromAsyncFactory` constraint.** Do not "simplify" it to `F extends ContextFactory` plus `& AsyncOutput<…>`: the prototype showed that rejects a genuine `async` contextual callback (`positive.ts` line 15 in the first run). The positive fixture's `contextualAsync` pins this.
4. **`PortableDiBag` slice** (Task 4). If `tests/platform-deno.test.ts` fails to typecheck on `portableContract(DiBag)`, widen the two slice members to `(factory: any) => any`; the fixture is bundled without type-checking on the platform side.
5. **Canonical JSON in the Deno test.** `denoResult`'s key order must be sorted (`aliasCanonical, asyncDisposerValue, asyncFulfilled, asyncPromiseIdentity, automatic, cleanupLog, …`); a wrong order fails only `'Deno child validation …'` with `child stdout is not one canonical JSON object`.
6. **AGENTS.md at 150/150.** Rule 1 must stay five lines; the recipe is linked from it, not from the bottom list.
7. **Recipe under 60 lines.** Counted at 58; one added line of prose breaks it.
8. **API card budget.** 337 + ~17 lines; keep the two `@example` blocks short.
9. **Message text pins.** Only `tests/runtime-diagnostics.test.ts:31` and the rewritten preflight test match the full classifier message; the other five match the unchanged prefix. Any later wording change must update the two.
10. **Preflight cost.** The success path is unchanged (return at the first automatic binding once the host answers); the full scan runs only when the build is about to throw. `runtime-scale.node.mjs` is the guard.

## Line estimate

| Area | Files | Estimate |
| --- | --- | --- |
| Runtime | `src/acquisition-context.ts`, `src/acquisition-mode.ts`, `src/types.ts`, `src/runtime.ts`, `src/di-bag.ts` | +140 / −25 |
| Type fixtures | `tests/types/portable-factories.ts`, `-consumer.ts`, `negative/portable-factories.ts`, `tests/types.test.ts`, `tests/native-diagnostic-markers.ts` | +95 |
| Runtime tests | `tests/portable-factories.test.ts`, `tests/acquisition-mode.test.ts`, `tests/runtime-diagnostics.test.ts` | +190 / −8 |
| Platform | `tests/platform/portable/contract.ts`, `tests/platform-deno.test.ts`, `tests/platform/browser-worker.test.ts`, `scripts/platform-evidence.ts` | +35 / −12 |
| Agent docs | `docs/agent/errors.md`, `docs/agent/recipes.md`, `AGENTS.md`, `tools/docs/api-card-tasks.json` | +110 / −20 (budgets: 150, <60 per recipe, 400 card) |
| Guides | `docs/guides/tutorial.md`, `docs/guides/server-integration.md`, `docs/guides/api-reference.md`, `README.md` | +80 / −55 |
| Reference (generated) | `docs/reference/**`, `api-coverage.json`, `docs/agent/api-card.md` | ~+90 |
