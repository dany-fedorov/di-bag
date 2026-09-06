# Box Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair, test, and package sas-box and val-box as reliable independent
foundations for di-bag acquisition and metadata adapters.

**Architecture:** Keep sas-box's sync callback result exact and use Awaited for
async access. Preserve val-box's compatibility classes, repair conversion
semantics, and add immutable presence-aware snapshots. Do not add DI ownership
or global memoization to either library.

**Tech Stack:** TypeScript 5.9.3, Bun runtime/compiler-fixture tests, ES2022
CommonJS output with verified Node ESM named-import consumers.

**Spec:** `docs/superpowers/specs/2026-09-06-enterprise-di-design.md`.

## Global Constraints

- No required decorators, reflect-metadata, parameter-name parsing, custom compiler transforms, or dynamic code generation.
- Plain functions, classes through adapters, promises, and ordinary service values remain supported.
- Preserve exact synchronous versus Promise-valued service types; never silently await an ordinary factory dependency.
- Preserve `DiBag.withDisposal` and explicit owned-versus-borrowed intent; method names alone never transfer ownership.
- Sharing is configurable and explicit; sharing an instance also shares its already-bound dependencies.
- Application startup closes resources it owns and initiates closure of bags it created; factories clean partial acquisitions before returning ownership.
- Justified public API changes are authorized; document migration and retain supported inference cases in regression tests.
- Test production behavior and compile-time contracts, including negative fixtures; record failing evidence before implementation.
- No publication, remote push, or credential storage without a separate explicit request; prepare local commits, package artifacts, and publishing instructions.
- Do not describe casts, unchecked JavaScript, or dynamically unknown plugins as compile-time proofs.

## File boundaries

Each task is confined to one independent repository. Both start on upstream's
default branch; create `feat/enterprise-foundations` before implementation.
Use `apply_patch` for edits. Review/install dependency declarations before
running setup. Replace unusable test scripts with runnable checks; do not run
legacy publish-me or destructive packaging scripts.

### Task 1: sas-box capability correctness and release-ready package

**Repository:** `.related-repos/sas-box` (all paths below relative to it).

**Files:**
- Modify: `src/index.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.build.json`, `README.md`.
- Create: `tests/runtime.test.ts`, `tests/types.test.ts`, `tests/types/positive.ts`, `tests/types/negative.ts`, `tests/package.test.ts`, `CHANGELOG.md`, `PUBLISHING.md`.

**Interfaces:**
- Preserve named classes `SasBoxUnknown`, `SasBoxSync`, `SasBoxAsync`, the
  `SasBox.Unknown/Sync/Async` aliases, and public access/assertion methods.
- `ISasBoxSync<T>` has `sync: () => T` and `async: () => Promise<Awaited<T>>`.
- Async-only boxes expose no sync callable; `fromAsync<T>(() => PromiseLike<T>)`
  returns a known async-only box of `Awaited<T>`.
- Add namespace conveniences `SasBox.fromSync`, `SasBox.fromAsync`, and
  `SasBox.fromValue`, with inference matching the class helpers.
- `resolveSyncFirst(thisArg?: unknown)` and its resolver return
  `Promise<Awaited<T>>`; callback throws become rejected promises while direct
  `.sync()` retains ordinary synchronous throwing behavior.
- No automatic memoization: repeated access can call the callback repeatedly.

- [ ] **Step 1: Establish tests and watch the known mismatch fail.**

Use strict compiler options from di-bag's `tests/types.test.ts` via a local test
helper, not an import from the sibling repository. The positive fixture must
include real inferred assignments (no casts):

```ts
const box = SasBox.Unknown.fromSync(() => Promise.resolve(42));
const raw: Promise<number> = box.sync();
const awaited: Promise<number> = box.async();
const asyncOnly = SasBox.Unknown.fromAsync(async () => 42);
const definitelyAsync: SasBox.Async<number> = asyncOnly;
```

Runtime cases: sync 42; Promise-returning sync callback flattens to 42 through
async access; structural thenable assimilation; a throwing sync callback's
`.async()` and `resolveSyncFirst()` reject with the identical error; a throwing
async callback rejects through `resolveSyncFirst`; supplied receiver reaches
the selected callback; missing sync assertion throws; dual constructor chooses
sync in sync-first mode; async-only alias identifies Async. Add negative
fixtures for assigning async access to `Promise<Promise<number>>`, calling an
async-only sync member, and incompatible dual callback result types.

Run `bun test tests/runtime.test.ts tests/types.test.ts`, preserving the
expected failing output before changing production source. Missing test tooling
is setup, not evidence of the behavioral failure.

- [ ] **Step 2: Implement the capability contract.**

Use `Awaited<T>` consistently at async boundaries. Normalize arbitrary
PromiseLike return values through Promise assimilation. Wrap callback invocation
in a try/catch returning Promise.reject or an async function so thrown errors
do not escape Promise-shaped entry points. Avoid `any` for receiver input.
Preserve the original sync value/Promise exactly; do not introduce caching.
Convenience constructors delegate to the same tested creation path.

```ts
export type ISasBoxSync<T> = {
  sync: () => T;
  async: () => Promise<Awaited<T>>;
};
```

- [ ] **Step 3: Package and document the new contract.**

Use version `0.1.0`, `main: ./dist/index.js`, `types: ./dist/index.d.ts`,
`exports` with matching types/default entries, and `files: ["dist"]`.
Use devDependencies `typescript: 5.9.3` and `@types/bun` consistent with the
parent's installed major; remove obsolete unused development dependencies.
Provide scripts `test`, `typecheck`, `build`, `check`, `prepack`; `check` runs
typecheck, tests, build, and `prepack` builds. No script publishes implicitly.
Package tests build and use the public package entry in Node require and ESM
named-import consumers, checking async errors and fulfilled values. Strict
compiler fixtures must also consume emitted declarations. README explains
Promise flattening, no implicit memoization, and known sync versus async modes.
CHANGELOG records the type correction and concrete async-only return.
PUBLISHING lists check, pack dry run, pack, local authentication, and explicit
publish commands; state no token should enter repository files or chat.

- [ ] **Step 4: Verify and commit in this repository.**

Run `npm run check`, `npm pack --dry-run`, and actual `npm pack` into an ignored
artifact directory. Inspect package contents; no tests, credentials, source
checkouts, or development artifacts leak into the published tarball. Run real
Node CJS/ESM consumers against the packaged files. Commit only task files as
`feat: harden sas-box acquisition capabilities and packaging`; do not push.
Report RED/GREEN commands/results, package filename, SHA, and concerns.

### Task 2: val-box conversion correctness, snapshots, and packaging

**Repository:** `.related-repos/val-box` (all paths below relative to it).

**Files:**
- Modify: `src/index.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.build.json`, `README.md`.
- Create: `src/snapshot.ts`, `tests/runtime.test.ts`, `tests/snapshot.test.ts`, `tests/types.test.ts`, `tests/types/positive.ts`, `tests/types/negative.ts`, `tests/package.test.ts`, `CHANGELOG.md`, `PUBLISHING.md`.

**Interfaces:**
- Preserve the existing classes/namespaces and mutable set/delete methods where
  their presence contracts permit those operations.
- Correct `assertHasMetadata` and `assertHasNoMetadata` independently of value.
- `convert` creates a new box: true requires/preserves presence, false removes
  that channel, absent/undefined preserves its current runtime state but gives
  an unknown static presence. Preserve intentional aliases and payload identity.
- Literal conversion flags produce precise classes; widened boolean flags must
  yield a sound union/unknown result, never a false known presence.
- Export the immutable types and `ValBox.snapshot(box)` below; snapshots are
  shallow immutable views, not deep-frozen payloads or ownership transfers.

```ts
export type Presence<T> =
  | { readonly present: false }
  | { readonly present: true; readonly value: T };
export interface ValBoxSnapshot<V, M> {
  readonly value: Presence<V>;
  readonly metadata: Presence<M>;
  readonly alias: string | null;
}
```

- [ ] **Step 1: Reproduce independent presence and conversion failures.**

Runtime fixtures include a metadata-only box successfully asserting metadata,
a value-only box rejecting that assertion, and a numeric value surviving
`convert({ hasValue: true })`. Exercise all nine literal combinations from
`hasValue`/`hasMetadata` in `[undefined, true, false]` using independently
specified expected presence flags. Include present undefined for both channels,
missing required values/metadata, alias preservation, and mutation isolation
between converted and original boxes (payload references intentionally shared).

```ts
const original = new ValBox.Unknown<number, string>('source')
  .setValue(42).setMetadata('db');
const both = original.convert({ hasValue: true, hasMetadata: true });
const value: number = both.getValue();
const metadata: string = both.getMetadata();
```

Strict fixtures check every conversion variant's getter result, including
widened/union options and forbidden mutations on no-value/no-metadata classes.
Run focused tests and record the original failures before source edits.

- [ ] **Step 2: Repair conversion and refinement.**

Read both presence flags from their own channels. Pass the actual value and
intentional alias to the WithValueUnknownMetadata constructor. Rewrite the
conditional return mapping to inspect value and metadata axes independently,
with literal false/true/undefined and widened booleans handled soundly. Preserve
the documented false-means-remove semantics. Fix the incorrect WithMetadata
alias definition and remove avoidable any-based recognition/conversion paths.
Do not rewrite unrelated compatibility classes solely for style.

- [ ] **Step 3: Test and implement immutable snapshots.**

```ts
const box = new ValBox.Unknown<number | undefined, string>()
  .setValue(undefined).setMetadata('db');
const snapshot = ValBox.snapshot(box);
box.setValue(42).delMetadata();
expect(snapshot.value).toEqual({ present: true, value: undefined });
expect(snapshot.metadata).toEqual({ present: true, value: 'db' });
```

Add absent-channel, intentional-alias, frozen outer/channel records, and shared
unfrozen payload identity cases. Compile narrowing on `snapshot.value.present`
must expose the correct V while direct absent `.value` access is rejected.
Implement the snapshot records in `src/snapshot.ts`, expose through index, and
avoid importing runtime ValBox classes into snapshot code when a read-only
structural source interface suffices.

- [ ] **Step 4: Package, document, verify, and commit.**

Use the same standalone scripts/package layout and pinned TypeScript setup as
Task 1, explicitly implemented in this repo; version `0.1.0`. Package tests use
Node CJS/ESM and emitted declarations to verify conversions and snapshot
presence. README explains mutable compatibility boxes versus immutable
snapshots, present undefined, conversion semantics, and payload ownership.
CHANGELOG lists the repaired assertions/conversion types and new snapshots.
PUBLISHING includes local authentication and explicit publish commands only.
Run focused tests, `npm run check`, `npm pack --dry-run`, actual tarball
inspection and packaged consumers. Commit only task files as
`feat: repair val-box refinements and add immutable snapshots`; do not push.
Report RED/GREEN commands/results, package filename, SHA, and concerns.
