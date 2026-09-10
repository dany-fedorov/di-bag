# Research: prior art for the `sas-box` sync/async capability box

> Historical research from 2026-09-09, published on 2026-09-10. DI Bag has since removed the box adapters in favor of native provider metadata. API descriptions and source assessments below refer to the original research snapshot; see the [current API guide](../guides/api-reference.md) for supported behavior.

**Date:** 2026-09-09

**Status:** Historical research; no API decision.

**Publication qualification (2026-09-10):** This survey did not establish
TypeScript-wide uniqueness. The [September 10 follow-up](2026-09-10-di-value-proposition.md)
identifies other statically checked async DI designs, including InferDI, and
refines the Awilix comparison: Promise-valued services differ from automatically
awaited dependency resolution. Use that follow-up for those comparisons.

**Question:** Is a value holder with two optional acquisition capabilities
(`sync: (() => T) | undefined`, `async: () => Promise<Awaited<T>>`), static
variants (`SasBoxSync`/`SasBoxAsync`/`SasBoxUnknown`), a `Promise.try`-style
`fromSync`, a `resolveSyncFirst` preference, and no memoization an established
pattern, or over-engineering relative to `T | Promise<T>` plus `Promise.try`?

## Scope and method

Every URL below was fetched on 2026-09-09; quotes are verbatim from that fetch.
Secondary write-ups were not used. Local ground truth: `sas-box`'s `fromSync`
wraps the call in `try { return Promise.resolve(fn()) } catch (e) { return Promise.reject(e) }`
([sas-box source snapshot](https://github.com/dany-fedorov/sas-box/blob/7588c37f6264f4898de686c4848f17ad68709abf/src/index.ts)), and `di-bag`'s adapter
[`src/sas-box.ts`](https://github.com/dany-fedorov/di-bag/blob/68dcfa288ad9014e4866ff938fae7f6976d77dd4/src/sas-box.ts) picks `sync` for `mode: 'sync'`,
`async` for `'async'`, and `sync` if it is a function else `async` for
`'sync-first'`.

Feature keys used in the tables: **slots** (two capability slots on one
object), **fallback** (consumer adapts the sync slot when the async one is
absent), **try** (sync throw normalized into a rejection), **static** (sync and
async forms are distinct static types), **no-memo** (holder does not cache).

## Verified precedents

| Pattern | Source | What it establishes | Maps to sas-box |
|---|---|---|---|
| "Don't release Zalgo" | [izs, 2013-08-23](https://blog.izs.me/2013/08/designing-apis-for-asynchrony/) | "If you have an API which takes a callback, and *sometimes* that callback is called immediately, and *other times* that callback is called at some point in the future, then you will render any code using this API impossible to reason about, and cause the release of Zalgo." | **slots**, **try**: each slot is one-mode; `async()` never resolves synchronously into a throw. |
| Sync-or-async as API contract | [Havoc Pennington, 2011-07-24](https://blog.ometer.com/2011/07/24/callbacks-synchronous-and-asynchronous/) (server answers HTTP 500 but serves the page) | "A given callback should be either always sync or always async, as a documented part of the API contract." | **static**: the mode is part of the type, not discovered per call. |
| `Promise.try` | [TC39 proposal, Stage 4](https://tc39.es/proposal-promise-try/); [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/try) | Spec: "Let status be Completion(Call(callbackfn, undefined, args))", then `[[Reject]]` on abrupt, `[[Resolve]]` on normal completion. MDN: "`Promise.try` also calls the function synchronously, and resolves the promise immediately if possible." | **try**: `fromSync(fn).async()` is `Promise.try(fn)`. |
| `await using` fallback to `Symbol.dispose` | [TC39 explicit resource management, GetDisposeMethod](https://tc39.es/proposal-explicit-resource-management/) | "Let method be ? GetMethod(V, @@asyncDispose). If method is undefined, then Set method be ? GetMethod(V, @@dispose)." The sync method is then wrapped in a closure that does `NewPromiseCapability(%Promise%)` and `Completion(Call(method, O))`. | **slots**, **fallback**, **try**: one object, two symbol slots, async consumer adapts the sync slot and converts its completion into a promise. |
| `for await` fallback to `Symbol.iterator` | [ecma262 `GetIterator(obj, kind)`](https://raw.githubusercontent.com/tc39/ecma262/main/spec.html) (`#sec-getiterator`) | "If kind is async, then Let method be ? GetMethod(obj, %Symbol.asyncIterator%). If method is undefined, then Let syncMethod be ? GetMethod(obj, %Symbol.iterator%) … Return CreateAsyncFromSyncIterator(syncIteratorRecord)." | **slots**, **fallback**: same shape; the language itself ships a sync-to-async adapter. |
| Effect constructors | [Creating Effects](https://effect.website/docs/getting-started/creating-effects/) | Four constructors split on two axes: `sync: () => A`, `try: () => A` (may throw), `promise: () => Promise<A>`, `tryPromise`. "Creates an `Effect` that represents a synchronous side-effectful computation." | **slots**, **try**: sync vs async is an explicit constructor choice; throwing sync code is a separate, normalized case. |
| `Effect.runSync` rejects async | [Running Effects](https://effect.website/docs/getting-started/running-effects/) | "If the effect fails or involves asynchronous work, it will throw an error, and execution will stop where the failure or async operation occurs." Error text: "Fiber #0 cannot be resolved synchronously. This is caused by using runSync on an effect that performs async work". | **static** (by contrast): Effect checks at runtime; sas-box moves the same check to `SasBoxAsync['sync']: never`. |
| Zod `parse` vs `parseAsync` | [zod.dev/api](https://zod.dev/api); [`core.ts`](https://raw.githubusercontent.com/colinhacks/zod/main/packages/zod/src/v4/core/core.ts); [`parse.ts`](https://raw.githubusercontent.com/colinhacks/zod/main/packages/zod/src/v4/core/parse.ts) | Docs: "If you use async refinements, you must use the `.parseAsync` method to parse data! Otherwise Zod will throw an error." Source: `if (result instanceof Promise) { throw new core.$ZodAsyncError(); }` with message "Encountered Promise during synchronous parse. Use .parseAsync() instead." | **static** (by contrast): runtime detection of a promise where sync was required; `assertHasSync()` is the same check hoisted to acquisition time. |
| InversifyJS `get` vs `getAsync` | [Container API](https://inversify.io/docs/api/container/); [Binding](https://inversify.io/docs/fundamentals/binding/); [`ServiceResolutionManager.ts`](https://raw.githubusercontent.com/inversify/monorepo/main/packages/container/libraries/container/src/container/services/ServiceResolutionManager.ts) | Docs: for `get`, "the binding must be synchronously resolved, otherwise an error is thrown"; "async bindings require the use of `Container.getAsync` or `Container.getAllAsync`". Source: `if (isPromise(resolvedValue)) throw new InversifyContainerError(… \`Unexpected asynchronous service when resolving service "…"\`)`. | **static** (by contrast) and the direct DI analogue of `fromSasBox(..., { mode })`: two entry points, runtime failure when sync meets async. |
| Microsoft.Extensions.DI guidelines | [DI guidelines](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection-guidelines) | "`async/await` and `Task` based service resolution isn't supported. Because C# doesn't support asynchronous constructors, use asynchronous methods after synchronously resolving the service." "Keep DI factories fast and synchronous." Anti-pattern section: "Async DI factories can cause deadlocks". | Counter-model: the graph is sync-only by policy. |
| dotnet/runtime async DI proposal | [#65656](https://github.com/dotnet/runtime/issues/65656) (davidfowl, opened 2022-02-21, still open); [#28696](https://github.com/dotnet/runtime/issues/28696) (closed) | Motivation: "inject a dependency as a result of an asynchronous operation … like retrieving a secret from a remote store". alistairjevans (Autofac): "the entire Autofac resolve pipeline will need to be updated to use `ValueTask<T>` instead of `T` … We can't only change the resolve path for the async registrations; the viral nature of async prevents it, unless we do sync-over-async". davidfowl: "map async resolution to `ValueTask/Task<TServiceType>`". | The problem sas-box addresses is real and unsolved in .NET; the proposed solution is a distinct async return type, i.e. **static**. |
| Autofac position | [autofac/Autofac#1215](https://github.com/autofac/Autofac/issues/1215), tillig 2020-10-14 | "Constructors are intentionally *fast* and *synchronous*." "If we do add `IStartableAsync` or something similar, I don't think we should get into `ResolveAsync`. If you're doing something to construct objects that requires async, you're doing something during construction you probably shouldn't be doing." | Counter-model: no async slot at all. |
| NestJS async providers | [Async providers](https://docs.nestjs.com/fundamentals/async-providers) | "Nest will await resolution of the promise before instantiating any class that depends on (injects) such a provider." | Counter-model: whole-graph async at bootstrap; no per-value sync capability. |
| Awilix position | [jeffijoe/awilix#12](https://github.com/jeffijoe/awilix/issues/12), jeffijoe 2017-02-19 | "At one point there was support for "async" registrations but it made the simpler usage way more complicated. To summarize: create your container when you have everything you need." | Counter-model: async before the container exists. |
| Dagger `Lazy<T>` vs `Provider<T>` | [dagger.Lazy](https://dagger.dev/api/latest/dagger/Lazy.html) | "Each `Lazy` computes its value on the first call to `get()` and remembers that same value for all subsequent calls." `Provider.get()` yields a new value each time. | **no-memo**: caching is a separate handle type, not a property of the acquisition slot. |
| `Lazy<T>` vs `AsyncLazy<T>` | [Stephen Toub, 2011-01-15](https://devblogs.microsoft.com/pfxteam/asynclazyt/); [Nito.AsyncEx AsyncLazy](https://raw.githubusercontent.com/StephenCleary/AsyncEx/master/doc/AsyncLazy.md) | "Lazy<T> doesn't support asynchronous initialization." `public class AsyncLazy<T> : Lazy<Task<T>>`. AsyncEx: "The factory method is only executed once." | **static**, **no-memo**: sync and async lazies are different types; the async one is the sync one composed with the async result type. |
| Node `fs` three forms | [fs](https://nodejs.org/api/fs.html) | "The synchronous APIs block the Node.js event loop and further JavaScript execution until the operation is complete. Exceptions are thrown immediately and can be handled using `try…catch`". Promise and callback forms documented alongside. | **slots**: same operation, mode-specific entry points, mode-specific error channel. |
| `crypto.scryptSync` | [crypto.md](https://raw.githubusercontent.com/nodejs/node/main/doc/api/crypto.md) | "Provides a synchronous scrypt implementation." "An exception is thrown when key derivation fails". | **slots**. |
| Sass `compile` / `compileAsync` | [compileAsync](https://sass-lang.com/documentation/js-api/functions/compileasync/) | "**compile is almost twice as fast as compileAsync**, due to the overhead of making the entire evaluation process asynchronous." | Justifies preferring `sync` when present (`resolveSyncFirst`, `mode: 'sync-first'`). |
| Prettier 3 async-only, `@prettier/sync` | [3.0 release](https://prettier.io/blog/2023/07/05/3.0.0); [prettier-synchronized](https://github.com/prettier/prettier-synchronized) | `prettier.format()` now returns `Promise<string>`; sync variants removed; "If you still need sync APIs, you can try `@prettier/sync`", a "simple wrapper of `make-synchronized`". | Losing the sync capability is a breaking change big enough to spawn a package; **slots** as explicit contract avoids the silent loss. |
| `glob` / `globSync`, `execa` / `execaSync` | [node-glob README](https://raw.githubusercontent.com/isaacs/node-glob/main/README.md); [execa execution.md](https://raw.githubusercontent.com/sindresorhus/execa/main/docs/execution.md) | glob: "the sync function is the same, just returns a `string[]` instead of `Promise<string[]>`". execa: sync "holds the CPU and prevents parallelization"; streams, `kill()`, piping, IPC unavailable in sync mode. | **slots**; also shows sync is a *different implementation*, not a wrapper choice. |
| `T \| Promise<T>` conventions | [Rollup `types.d.ts`](https://raw.githubusercontent.com/rollup/rollup/master/src/rollup/types.d.ts) l.24; [Vitest `types.ts`](https://raw.githubusercontent.com/vitest-dev/vitest/main/packages/utils/src/types.ts) l.1; [Vite `plugin.ts`](https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/node/plugin.ts) l.145; [Fastify Hooks](https://fastify.dev/docs/latest/Reference/Hooks/); [TS 4.5 `Awaited`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-5.html) | `type MaybePromise<T> = T \| Promise<T>;` `export type Awaitable<T> = T \| PromiseLike<T>`; `Promise<ResolveIdResult> \| ResolveIdResult`. Fastify: "The `done` callback is not available when using `async`/`await` or returning a `Promise`. If you do invoke a `done` callback in this situation unexpected behavior may occur, e.g. duplicate invocation of handlers." `Awaited` "recursively unwrap[s] `Promise`s". | Counter-model: producer-side union, consumer always awaits. `Promise<Awaited<T>>` in sas-box reuses the same primitive. |
| Cross-language duality | [unasync](https://raw.githubusercontent.com/python-trio/unasync/master/README.rst); [Nystrom, 2015-02-01](https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/) | unasync: "a project that can transform your asynchronous code into synchronous code", used by the Elasticsearch client, Hip, and (differently) httpcore. Nystrom: "Every function has a color." "You can only call a red function from within another red function." "Red functions are asynchronous ones." | The capability axis is not a JS artifact; ecosystems generate whole sync twins rather than unify. |

## Counter-evidence

- **These three surveyed TypeScript APIs do not encode sync/async in the
  type.** `Effect<A, E, R>` has no async marker: `runSync` fails at
  [runtime](https://effect.website/docs/getting-started/running-effects/).
  Zod's schema type does not record async refinements; `parse` throws
  [`$ZodAsyncError`](https://raw.githubusercontent.com/colinhacks/zod/main/packages/zod/src/v4/core/core.ts).
  Inversify's `get<T>` is typed `T` even for async bindings and throws
  ["Unexpected asynchronous service"](https://raw.githubusercontent.com/inversify/monorepo/main/packages/container/libraries/container/src/container/services/ServiceResolutionManager.ts).
  This comparison found no equivalent static split in these three APIs; it
  does not establish absence across TypeScript libraries. The survey also
  found .NET's `Lazy<T>`/`AsyncLazy<T>` and the ES protocol pairs.
- **Mainstream DI containers refuse the problem rather than model it.**
  [Microsoft DI](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection-guidelines)
  ("isn't supported"), [Autofac](https://github.com/autofac/Autofac/issues/1215)
  ("I don't think we should get into `ResolveAsync`"), and
  [Awilix](https://github.com/jeffijoe/awilix/issues/12) ("create your container
  when you have everything you need") push async to the composition root.
  [NestJS](https://docs.nestjs.com/fundamentals/async-providers) makes the whole
  bootstrap async instead. Neither camp needs a per-value capability holder.
- **Where the host is always async, `T | Promise<T>` wins.** Rollup, Vite,
  Vitest, and Fastify all accept either form from plugin/hook authors and
  normalize with `await`. This is strictly simpler than a two-slot box and is
  sufficient for `fromSasBox` modes `'async'` and `'sync-first'`. It cannot
  express "definitely sync" for a consumer that must not await, which is the
  only case `mode: 'sync'` serves.
- **Platform preference order is the reverse of `sync-first`.**
  [`GetDisposeMethod`](https://tc39.es/proposal-explicit-resource-management/)
  and [`GetIterator`](https://raw.githubusercontent.com/tc39/ecma262/main/spec.html)
  try the *async* slot first and fall back to sync. sas-box's `resolveSyncFirst`
  prefers sync. The justification available is performance
  ([Sass](https://sass-lang.com/documentation/js-api/functions/compileasync/)),
  not spec precedent; and Fastify's note shows that letting one call site
  satisfy both modes is a documented footgun.
- **Sync variants are usually distinct implementations, not wrappers.**
  [execa](https://raw.githubusercontent.com/sindresorhus/execa/main/docs/execution.md)
  drops streams/IPC/kill in sync mode; Sass's sync path is a different
  evaluator. A box that only *routes* to one of two functions adds nothing to
  libraries that already expose both; its value is confined to consumers that
  must *choose* (DI resolution) or *prove* (types) a mode.

## Leads that did not check out

- No Autofac docs page on "Asynchronous resolution": `advanced/async-resolution.html`
  is 404 and the [FAQ index](https://autofac.readthedocs.io/en/latest/faq/) lists
  no async entry. Position verified from maintainer comments on #1215 instead.
- Awilix [README](https://raw.githubusercontent.com/jeffijoe/awilix/master/README.md)
  states no promise-as-value policy; only `loadModules({ esModules })` and
  `dispose()` return promises. Position verified from issue #12; #175 has no
  maintainer reply.
- Vite has no `Awaitable<T>` alias (GitHub code search for `"type Awaitable"` in
  `vitejs/vite`: 0 hits); hooks use inline `Promise<X> | X`. `Awaitable` lives in
  Vitest's `@vitest/utils`.
- `@prettier/sync` is built on `make-synchronized`, not `synckit` (the README
  lists `synckit` only as an alternative).
- The `Promise.try` proposal page says "Stage 4 Draft" and does not itself state
  the ES2025 edition. It is present in the current
  [ecma262 main draft](https://raw.githubusercontent.com/tc39/ecma262/main/spec.html)
  (`#sec-promise.try`); which numbered edition first carried it was not verified.
- TypeScript's `Disposable`/`AsyncDisposable` lib declarations could not be
  located on `main` (404 at `src/lib/esnext.disposable.d.ts`; code search
  returned nothing), so the static-pair claim rests on the ES spec, not on TS lib.
- Effect's wording is "involves asynchronous work", not "performs async
  operations" as in the lead.
- Stephen Cleary's blog post returned 403; the AsyncEx repo doc was used instead.
- dotnet/runtime #28696 is closed with no maintainer comment retrievable via the
  API; only #65656 is cited for maintainer positions.

## Conclusions

1. **Two capability slots on one object is a language-level idiom, not
   over-engineering.** `Symbol.dispose`/`Symbol.asyncDispose` and
   `Symbol.iterator`/`Symbol.asyncIterator` are exactly this shape, and the spec
   ships the sync-to-async adapter (`GetDisposeMethod`, `CreateAsyncFromSyncIterator`).
2. **`fromSync(fn).async()` is redundant with `Promise.try(fn)`** in runtime
   behavior. The only residual value is contractual: the box promises that
   `async()` never throws synchronously (Zalgo rule), which `Promise.try` also
   delivers. On engines with `Promise.try`, the helper should delegate to it.
3. **The surveyed Effect, Zod, and Inversify sync APIs reject async work at
   runtime.** The static `SasBoxAsync['sync']: never` split differs from those
   APIs, but the survey does not establish ecosystem-wide novelty. The
   [follow-up](2026-09-10-di-value-proposition.md) discusses other statically
   checked async DI designs. The split is worth its type-complexity cost only
   if compile-time proof of `mode: 'sync'` acquirability is a product requirement.
4. **The mainstream alternative is "no async in the graph."** MS DI, Autofac, and
   Awilix all reject async resolution and move it to bootstrap; #65656 shows the
   cost of adding it later is pipeline-wide (async virality). `di-bag` can drop
   sas-box entirely by adopting that policy; what it loses is lazily acquired
   async services, which is precisely the still-open gap in .NET.
5. **`T | Promise<T>` plus `Awaited` is sufficient for every async-capable
   consumer** (Rollup/Vite/Vitest/Fastify precedent). sas-box is redundant for
   `mode: 'async'` and `'sync-first'`; it is not redundant for `mode: 'sync'`,
   because a union cannot prove the absence of a promise.
6. **Not memoizing is correct.** Dagger separates `Provider` from `Lazy`; Toub
   builds `AsyncLazy<T>` as `Lazy<Task<T>>`, i.e. caching composed over the async
   variant. Caching belongs to the DI lifetime layer, not the capability holder.
7. **`sync-first` needs an explicit rationale.** The platform falls back
   async-to-sync; preferring sync is a performance choice (Sass: "almost twice
   as fast"). Document it as deliberate, and keep `mode` explicit at the adapter
   rather than letting one call site accept both (Fastify's duplicate-invocation
   warning).
8. **Net assessment:** the abstraction is small and has precedents in shape;
   its runtime half duplicates `Promise.try`. The static split should be
   evaluated against the required sync proof, not a claim of TypeScript-wide
   novelty. When that proof is unnecessary, `T | Promise<T>` is a simpler
   representation for async-capable consumers; bootstrap-only initialization
   is one possible policy, not a requirement of that union type.
