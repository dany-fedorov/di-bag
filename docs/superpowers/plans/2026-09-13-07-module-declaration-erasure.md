# Module Declaration Erasure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sealed module's public type, and therefore the `.d.ts` a library emits for it, names only what the installing host needs: exported services, external requirements, and compact constraints. Private registration names and types no longer leak, private edits no longer invalidate consumers, and consumers stop re-paying the module's type-check cost.

**Architecture:** Three sources leak today. (1) Export and requirement maps print as alias instantiations over the full registrations object (`Pick<ServicesOf<RegistrationsFromEntries<...>>, K>`); flattening string-keyed parts with an unexported mapped type makes declaration emit print the resolved object, while symbol-keyed parts must stay `Record<typeof key, Service>` references because emit cannot serialize an expanded unique-symbol property (verified 2026-09-13). (2) Lifetime obligations and exported lifetime carriers retain `LexicalContext<R, ...>`, the whole registrations map, so the host can walk into the module at build time. This plan moves that walk to seal time: `buildModule` computes, per strict root and per exported carrier, which export or external keys its dependencies reach, and retains only those compact obligations. A root that reaches a private scoped service fails at `buildModule`. (3) Contribution constraints carry a `ModuleScope`; they get the same reach treatment.

**Tech Stack:** TypeScript conditional and mapped types, the existing type fixtures under `tests/types`, declaration-emit tests modeled on `tests/types.test.ts`.

**Spec:** `docs/superpowers/specs/2026-09-13-agentic-scale-hardening.md` (decision D1)

**Depends on:** plan 01 (shared compiler, `options` export, test lanes) and plan 03 (`NameText`).

## Global Constraints

- Minimum supported TypeScript 6.0.3; `npm run check:native` must keep passing with zero message gaps.
- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` stay on.
- Every fixture in `tests/types/**` and every negative marker keeps passing except where this plan moves a marker from a host `build()` line to a `buildModule()` line (Task 5 lists them).
- The type-scale gates stay green, including `1000 providers from reusable named modules` and the `--tokens` module cases.
- Runtime behavior does not change; edits to `src/module.ts` are type-signature only, and `src/runtime.ts` is untouched.
- This is a breaking change for type-only exports: `LexicalContext`, `ModuleScope`, `Enclosed`, `RenamedContext`, `EnclosedLifetimeObligation`, `RenamedLifetimeObligation`, `RenamedLifetimeProviders` are removed; `CHANGELOG.md` records it under `### Breaking changes`.
- Time box for Task 4 and Task 5 together: if the listed fixtures do not pass after four focused sessions, stop, keep Tasks 1 to 3 (which already shrink string-keyed modules without lifetime carriers), and record the remaining failures in the plan file for the next attempt.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

---

### Task 1: Characterization tests (failing on purpose)

**Files:**
- Create: `tests/types/module-erasure/feature.ts`, `tests/types/module-erasure/consumer.ts`
- Create: `tests/types/negative/module-erasure.ts`
- Create: `tests/module-declarations.test.ts`
- Modify: `scripts/test-lane.mjs` (add `module-declarations` to the compiler lane)
- Modify: `tests/types.test.ts` (one positive fixture test)

- [ ] **Step 1: Write the producer fixture**

```ts
// tests/types/module-erasure/feature.ts
import { DiBag } from '../../../src';

/** Private type: must not appear in the emitted declaration. */
export type PrivateCacheShape = { entries: Map<string, number> };
const tokenKey = Symbol('token');
export const tokenService = DiBag.token(tokenKey).of<{ id: number }>();

export const feature = DiBag.createBuilder()
  .register({
    privateCache: DiBag.withLifetime((): PrivateCacheShape => ({ entries: new Map() }), 'root'),
    privateHelper: DiBag.withLifetime(({ privateCache }: { privateCache: PrivateCacheShape }) => (key: string) => privateCache.entries.get(key) ?? 0, 'root'),
    // Exported strict root over private roots: no obligation survives sealing.
    service: DiBag.withLifetime(({ privateHelper }: { privateHelper: (key: string) => number }) => ({ read: (key: string) => privateHelper(key) }), 'root'),
    // Exported transient over an external requirement: a carrier obligation reaching `external`.
    passthrough: DiBag.withLifetime(({ external, privateHelper }: { external: string; privateHelper: (key: string) => number }) => () => privateHelper(external), 'transient'),
    // Private consumer of an export: a checked constraint the host must keep satisfying.
    privateConsumer: ({ service }: { service: { read(key: string): number } }) => service.read('x'),
  })
  .register(tokenService, () => ({ id: 1 }))
  .buildModule(['service', 'passthrough', tokenService]);
```

- [ ] **Step 2: Write the consumer fixture**

```ts
// tests/types/module-erasure/consumer.ts
import { DiBag, type ModuleExportedServices, type ModuleRequiredServices, type TokenKey } from '../../../src';
import { feature, tokenService } from './feature';
import type { Assert, Equal } from '../assert';

type Exported = Assert<Equal<keyof ModuleExportedServices<typeof feature>, 'service' | 'passthrough' | TokenKey<typeof tokenService>>>;
type Required = Assert<Equal<ModuleRequiredServices<typeof feature>, Readonly<{ external: string }>>>;

export const host = DiBag.createBuilder().installModule(feature).register({ external: () => 'x' }).build();
const service = host.resolve('service');
type Service = Assert<Equal<typeof service, { read: (key: string) => number }>>;
export const id: number = host.resolve(tokenService).id;
export const count: number = host.resolve('passthrough')();

// Replacing an export stays checked against the private consumer's needs.
export const replaced = DiBag.createBuilder().installModule(feature).register({ external: () => 'x' })
  .replace('service', DiBag.withLifetime(() => ({ read: (_key: string) => 2 }), 'root')).build();

// A host root through the exported transient reaches `external`, which is a root here: accepted.
export const rootHost = DiBag.createBuilder().installModule(feature).register({
  external: DiBag.withLifetime(() => 'x', 'root'),
  api: DiBag.withLifetime(({ passthrough }: { passthrough: () => number }) => passthrough(), 'root'),
}).build();

// Renaming keeps the carrier obligation attached to the new name.
export const renamedHost = DiBag.createBuilder().installModule(feature.renameExport('passthrough', 'through')).register({
  external: DiBag.withLifetime(() => 'x', 'root'),
  api: DiBag.withLifetime(({ through }: { through: () => number }) => through(), 'root'),
}).build();
```

- [ ] **Step 3: Write the negative fixture**

```ts
// tests/types/negative/module-erasure.ts
import { DiBag } from '../../../src';
import { feature } from '../module-erasure/feature';
// diagnostic: root lifetime cannot capture scoped dependency: api -> external
DiBag.createBuilder().installModule(feature).register({ external: () => 'x', api: DiBag.withLifetime(({ passthrough }: { passthrough: () => number }) => passthrough(), 'root') }).build();
// diagnostic: root lifetime cannot capture scoped dependency: api -> external
DiBag.createBuilder().installModule(feature.renameExport('passthrough', 'through')).register({ external: () => 'x', api: DiBag.withLifetime(({ through }: { through: () => number }) => through(), 'root') }).build();
const helper = DiBag.createBuilder().register({ helper: () => 1, api: DiBag.withLifetime(({ helper }: { helper: number }) => helper, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency: api -> helper
helper.buildModule(['api']);
// diagnostic: provided service does not satisfy its consumer dependency: privateConsumer needs service
DiBag.createBuilder().installModule(feature).register({ external: () => 'x' }).replace('service', () => ({ read: (_key: string) => 'text' }));
```

- [ ] **Step 4: Write the declaration test**

```ts
// tests/module-declarations.test.ts
import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import ts from 'typescript';
import { options } from './compiler';

const producer = resolve(__dirname, 'types/module-erasure/feature.ts');
const consumer = resolve(__dirname, 'types/module-erasure/consumer.ts');
const declarationPath = producer.replace(/\.ts$/, '.d.ts');

function emitDeclaration(): string {
  const output = resolve(__dirname, 'generated-module-erasure');
  const emitOptions: ts.CompilerOptions = { ...options, noEmit: false, declaration: true, emitDeclarationOnly: true, rootDir: resolve(__dirname, '..'), outDir: output };
  const declarations = new Map<string, string>();
  const host = ts.createCompilerHost(emitOptions);
  host.writeFile = (name, text) => { declarations.set(name, text); };
  const program = ts.createProgram([producer], emitOptions, host);
  const emitted = program.emit();
  expect([...ts.getPreEmitDiagnostics(program), ...emitted.diagnostics].map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
  const declaration = declarations.get(resolve(output, 'tests/types/module-erasure/feature.d.ts'));
  expect(declaration).toBeDefined();
  return declaration!;
}

test('a sealed module declaration names no private registration or private type', () => {
  const declaration = emitDeclaration();
  for (const name of ['privateCache', 'privateHelper', 'PrivateCacheShape']) expect(declaration).not.toContain(name);
});

test('a sealed module declaration is compact', () => {
  expect(emitDeclaration().length).toBeLessThan(2_500);
});

test('the consumer type-checks against the emitted declaration alone', () => {
  const declaration = emitDeclaration();
  const consumerHost = ts.createCompilerHost(options);
  const exists = consumerHost.fileExists.bind(consumerHost);
  const read = consumerHost.getSourceFile.bind(consumerHost);
  consumerHost.fileExists = name => name === producer ? false : name === declarationPath ? true : exists(name);
  consumerHost.getSourceFile = (name, version, onError, fresh) => name === producer ? undefined
    : name === declarationPath ? ts.createSourceFile(name, declaration, version, true) : read(name, version, onError, fresh);
  const program = ts.createProgram([consumer], options, consumerHost);
  expect(program.getSourceFile(producer)).toBeUndefined();
  expect(ts.getPreEmitDiagnostics(program).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
```

Add `'module-declarations'` to the `compilerLane` set in `scripts/test-lane.mjs`, and add to `tests/types.test.ts`:

```ts
test('module erasure fixtures keep exact exports, requirements, and carrier obligations', () => {
  expect(diagnostics(resolve(__dirname, 'types/module-erasure/consumer.ts')).map(error =>
    ts.flattenDiagnosticMessageText(error.messageText, '\n'))).toEqual([]);
});
```

- [ ] **Step 5: Run and record the failures**

Run: `bun test tests/module-declarations.test.ts tests/types.test.ts -t "module erasure|module-erasure"`
Expected: the consumer fixture passes today (behavior is unchanged), `module-erasure.ts` fails on its third marker (the seal-time captive is reported at the host today) and possibly the fourth, and both declaration assertions fail: private names present, size above budget. Note the current byte size in the commit message.

- [ ] **Step 6: Commit the failing characterization**

```bash
git add tests/types/module-erasure tests/types/negative/module-erasure.ts tests/module-declarations.test.ts scripts/test-lane.mjs tests/types.test.ts
git commit -m "test: characterize private type leakage in sealed module declarations"
```

---

### Task 2: Flatten string-keyed exports; keep symbol keys as `Record` references

**Files:**
- Modify: `src/types.ts` (add `Resolved`, `Intersect`)
- Modify: `src/di-bag.ts` (`buildModule` return type)
- Modify: `src/module-types.ts` (remove the local `Intersect`, import it)

- [ ] **Step 1: Add the helpers to `src/types.ts`**

Append at the end of `src/types.ts`:

```ts
/**
 * Force a projection to print as a resolved object type in declarations. Keep this alias out of
 * the package index: an inaccessible alias makes declaration emit expand it, which is the point.
 */
export type Resolved<T> = { [K in keyof T]: T[K] };
export type Intersect<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;
// Declaration emit cannot serialize an expanded property named by a unique symbol, so symbol keys
// stay `Record` references, which print by name and carry only the key and service types.
type SymbolExports<S, K> = [Extract<K, symbol>] extends [never] ? unknown : Intersect<K extends symbol ? Record<K, S[K & keyof S]> : never>;
/** The services a sealed module exports, printed without the registrations they came from. */
export type ExportedServices<S, K extends keyof S> = Resolved<Pick<S, Extract<K, string>>> & SymbolExports<S, K>;
```

- [ ] **Step 2: Use it in `buildModule`**

In `src/di-bag.ts`, add `ExportedServices,` to the `import type { ... } from './types';` list, and change the first type argument of the `buildModule` return type from

```ts
    Pick<ServicesOf<RegistrationsFromEntries<E>>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>,
```

to

```ts
    ExportedServices<ServicesOf<RegistrationsFromEntries<E>>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>>,
```

In `src/module-types.ts`, delete the local `type Intersect<U> = ...` declaration and add `Intersect` to the import from `./types`.

- [ ] **Step 3: Run the module fixtures**

Run: `npm run typecheck && bun test tests/types.test.ts -t "module|nested|plugins|token" tests/type-scale.test.ts tests/token-scale.test.ts tests/package.test.ts`
Expected: all PASS, including `plugins inferred exports survive declaration consumption` (symbol-keyed exports) and `named modules preserve contracts across a file boundary`.

Run: `bun test tests/module-declarations.test.ts`
Expected: the private-name test still fails (constraints and carriers still leak); the size drops. Record the new size.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/di-bag.ts src/module-types.ts
git commit -m "feat: print sealed module exports as resolved object types"
```

---

### Task 3: Flatten requirement and constraint `needs`

**Files:**
- Modify: `src/module-types.ts` (`Constraint`, `ExternalRequirements`)

- [ ] **Step 1: Resolve the picked needs**

Add `Resolved,` to the import from `./types` in `src/module-types.ts`. Change

```ts
type Constraint<K extends string | symbol, N, Keys extends keyof N, Kind extends string> =
  [Keys] extends [never] ? never : { readonly consumer: K; readonly needs: Pick<N, Keys>; readonly kind: Kind };
```

to

```ts
type Constraint<K extends string | symbol, N, Keys extends keyof N, Kind extends string> =
  [Keys] extends [never] ? never : { readonly consumer: K; readonly needs: Resolved<Pick<N, Keys>>; readonly kind: Kind };
```

Change `ExternalRequirements` to

```ts
export type ExternalRequirements<C> = [External<C>] extends [never] ? Readonly<{}>
  : Readonly<Resolved<Intersect<External<C>>>>;
```

- [ ] **Step 2: Run the fixtures**

Run: `npm run typecheck && bun test tests/types.test.ts tests/type-scale.test.ts`
Expected: all PASS. `tests/types/nested-modules.ts` asserts `ModuleRequiredServices` equality with `Readonly<{ ... }>`; `Resolved<Intersect<...>>` is structurally identical.

- [ ] **Step 3: Commit**

```bash
git add src/module-types.ts
git commit -m "feat: print module requirements and constraint needs as resolved objects"
```

---

### Task 4: Seal-time lifetime obligations

**Files:**
- Rewrite: `src/lifetime-types.ts`
- Modify: `src/module-types.ts` (`NeedConstraint`, `ModuleConstraints`, `SealedConstraints`, `RenamedConstraints`, `ModulePublicProviders`, `IncrementalConstraints`)
- Modify: `src/contribution-types.ts` (`Contribution`, `ModuleContributionConstraints`, `RenamedContribution`)
- Modify: `src/scope-types.ts` (`Transients`, `ScopeOptions`, `CanonicalLifetime` gains a constraint parameter)
- Modify: `src/di-bag.ts` (`buildModule` admission; `replace`, `fork`, `createScope` drop carrier obligations for replaced keys; `ScopeOptions<R, S, C>`)
- Modify: `src/index.ts` (drop removed exports; export `LifetimeObligation`, `Reach`)

**Interfaces:**
- Produces, in `src/lifetime-types.ts`:
  - `Reach = { kind: 'export'; key } | { kind: 'external'; key } | { kind: 'scoped'; key }`
  - `RootObligation = { kind: 'root-reach'; root: PropertyKey; reach: Reach }`
  - `CarrierObligation = { kind: 'carrier-reach'; export: PropertyKey; policy: 'transient' | 'scoped' | 'root'; reach: Reach }`
  - `ContributionObligation = { kind: 'contribution-reach'; token: TokenBase; reach: Reach }`
  - `LifetimeObligation = RootObligation | CarrierObligation | ContributionObligation`
  - `SealedLifetimes<R, P, C>` (the union of obligations a module retains, or an `Unsatisfied` when a root captures a private scoped service)
  - `CheckedLifetimes<R, C>`, `CheckedScopeLifetimes<R, O, C>` (same names and roles as today), `CanonicalLifetime<R, K, C>`.

- [ ] **Step 1: Replace `src/lifetime-types.ts`**

```ts
import type { ContributionConstraint } from './contribution-types';
import type { NeedConstraint } from './module-types';
import type { Registration, Registrations } from './registration';
import type { ProviderGraphContract, ProviderNamedDependencies, ProviderRequiredTokens, ProviderOptionalTokens, ProviderCollectionTokens } from './provider';
import type { TokenBase, TokenKey } from './tokens';
import type { NameText, Unsatisfied } from './types';

/** Where a lifetime walk leaves a sealed module: a key the installing host resolves, or a private scoped dead end. */
export type Reach =
  | { readonly kind: 'export'; readonly key: PropertyKey }
  | { readonly kind: 'external'; readonly key: PropertyKey }
  | { readonly kind: 'scoped'; readonly key: PropertyKey };
/** A strict root sealed inside a module and one outside key its dependencies reach. */
export type RootObligation = { readonly kind: 'root-reach'; readonly root: PropertyKey; readonly reach: Reach };
/** An exported non-root carrier (transient or alias) and one key its dependencies reach; a root using the export walks through it. */
export type CarrierObligation = { readonly kind: 'carrier-reach'; readonly export: PropertyKey; readonly policy: 'transient' | 'scoped' | 'root'; readonly reach: Reach };
/** A sealed contribution and one key its dependencies reach; a root reading the collection walks through it. */
export type ContributionObligation = { readonly kind: 'contribution-reach'; readonly token: TokenBase; readonly reach: Reach };
export type LifetimeObligation = RootObligation | CarrierObligation | ContributionObligation;

type Policy<V extends Registration> = ProviderGraphContract<V> extends { readonly lifetime: { readonly kind: infer L } } ? L
  : ProviderGraphContract<V> extends { readonly alias: PropertyKey } ? 'alias' : 'scoped';
type AliasKey<V extends Registration> = ProviderGraphContract<V> extends { readonly alias: infer A extends PropertyKey } ? A : never;
type Strict<V extends Registration> = ProviderGraphContract<V> extends { readonly lifetime: { readonly kind: 'root'; readonly allowScopedDependencies: infer A } }
  ? [A] extends [true] ? false : true : false;
type Dependencies<V extends Registration> = keyof ProviderNamedDependencies<V> | TokenKey<ProviderRequiredTokens<V> | ProviderOptionalTokens<V>>;
type Carriers<C, K> = Extract<C, { readonly kind: 'carrier-reach'; readonly export: K }>;
type ContributionReaches<C, T> = Extract<C, { readonly kind: 'contribution-reach'; readonly token: T }>['reach'];
type OwnContributions<C, T> = Extract<C, ContributionConstraint & { readonly token: T }>['registration'];

// ---- Seal time: which keys does each registration reach outside the module? ----
// Exported keys stop the walk (the host may replace them); private roots end it; private scoped
// registrations are dead ends; private transients and aliases are followed.
type ReachOf<R extends Registrations, P extends PropertyKey, C, D, Visited> = D extends P
  ? { readonly kind: 'export'; readonly key: D }
  : D extends keyof R ? D extends Visited ? never
    : Policy<R[D]> extends 'root' ? never
    : Policy<R[D]> extends 'scoped' ? { readonly kind: 'scoped'; readonly key: D }
    : Policy<R[D]> extends 'alias' ? ReachOf<R, P, C, AliasKey<R[D]>, Visited | D>
    : ReachesOf<R, P, C, R[D], D, Visited | D>
  : D extends PropertyKey ? { readonly kind: 'external'; readonly key: D } : never;
type FollowReach<R extends Registrations, P extends PropertyKey, C, X, Visited> = X extends { readonly kind: 'scoped' } ? X
  : X extends { readonly key: infer D } ? ReachOf<R, P, C, D, Visited> : never;
type ReachesOf<R extends Registrations, P extends PropertyKey, C, V extends Registration, K, Visited> =
  | ReachOf<R, P, C, Dependencies<V>, Visited>
  | FollowReach<R, P, C, Carriers<C, K>['reach'], Visited>
  | (ProviderCollectionTokens<V> extends infer T ? T extends TokenBase
      ? FollowReach<R, P, C, ContributionReaches<C, T>, Visited>
        | (OwnContributions<C, T> extends infer W ? W extends Registration ? ReachesOf<R, P, C, W, never, Visited> : never : never)
      : never : never);

type OwnRoots<R extends Registrations, P extends PropertyKey, C> = {
  [K in keyof R]: true extends Strict<R[K]> ? ReachesOf<R, P, C, R[K], K, K> extends infer X ? X extends Reach
    ? { readonly kind: 'root-reach'; readonly root: K; readonly reach: X } : never : never : never;
}[keyof R];
type RetainedRoots<R extends Registrations, P extends PropertyKey, C> = C extends RootObligation
  ? FollowReach<R, P, C, C['reach'], never> extends infer X ? X extends Reach
    ? { readonly kind: 'root-reach'; readonly root: C['root']; readonly reach: X } : never : never : never;
type CanonicalPolicy<R extends Registrations, C, K, Visited = never> = K extends keyof R
  ? Policy<R[K]> extends 'alias' ? K extends Visited ? 'scoped' : CanonicalPolicy<R, C, AliasKey<R[K]>, Visited | K>
  : Policy<R[K]> extends 'transient' ? Carriers<C, K> extends never ? 'transient' : Carriers<C, K>['policy']
  : Policy<R[K]> : 'scoped';
type OwnCarriers<R extends Registrations, P extends PropertyKey, C> = {
  [K in P & keyof R]: Policy<R[K]> extends 'root' | 'scoped' ? never
    : { readonly kind: 'carrier-reach'; readonly export: K; readonly policy: CanonicalPolicy<R, C, K>; readonly reach: ReachesOf<R, P, C, R[K], K, K> };
}[P & keyof R];
type RetainedCarriers<R extends Registrations, P extends PropertyKey, C> = C extends CarrierObligation
  ? C['export'] extends P ? FollowReach<R, P, C, C['reach'], never> extends infer X ? X extends Reach
    ? { readonly kind: 'carrier-reach'; readonly export: C['export']; readonly policy: C['policy']; readonly reach: X } : never : never : never : never;
type OwnContributionReaches<R extends Registrations, P extends PropertyKey, C> = C extends ContributionConstraint
  ? ReachesOf<R, P, C, C['registration'], never, never> extends infer X ? X extends Reach
    ? { readonly kind: 'contribution-reach'; readonly token: C['token']; readonly reach: X } : never : never : never;
type RetainedContributionReaches<R extends Registrations, P extends PropertyKey, C> = C extends ContributionObligation
  ? FollowReach<R, P, C, C['reach'], never> extends infer X ? X extends Reach
    ? { readonly kind: 'contribution-reach'; readonly token: C['token']; readonly reach: X } : never : never : never;
type SealedCaptives<R extends Registrations, P extends PropertyKey, C> = Extract<OwnRoots<R, P, C> | RetainedRoots<R, P, C>, { readonly reach: { readonly kind: 'scoped' } }>;
type CaptiveText<O> = O extends { readonly root: infer Root; readonly reach: { readonly key: infer D } } ? `${NameText<Root>} -> ${NameText<D>}` : never;
/** Every compact obligation a sealing builder retains, or the seal-time rejection of a private captive. */
export type SealedLifetimes<R extends Registrations, P extends PropertyKey, C> = [SealedCaptives<R, P, C>] extends [never]
  ? Exclude<OwnRoots<R, P, C> | RetainedRoots<R, P, C>, { readonly reach: { readonly kind: 'scoped' } }>
    | OwnCarriers<R, P, C> | RetainedCarriers<R, P, C> | OwnContributionReaches<R, P, C> | RetainedContributionReaches<R, P, C>
  : Unsatisfied<`root lifetime cannot capture scoped dependency: ${CaptiveText<SealedCaptives<R, P, C>>}`, { readonly captives: SealedCaptives<R, P, C> }>;
/** Admission for `buildModule`: `unknown` when sealing succeeds. */
export type SealAdmission<R extends Registrations, P extends PropertyKey, C> = [SealedCaptives<R, P, C>] extends [never] ? unknown
  : Unsatisfied<`root lifetime cannot capture scoped dependency: ${CaptiveText<SealedCaptives<R, P, C>>}`, { readonly captives: SealedCaptives<R, P, C> }>;
/** Rename the export key inside retained obligations. */
export type RenamedObligation<O, Old extends string, New extends string> = O extends { readonly reach: { readonly kind: 'export'; readonly key: Old } }
  ? Omit<O, 'reach'> & { readonly reach: { readonly kind: 'export'; readonly key: New } }
  : O extends { readonly kind: 'carrier-reach'; readonly export: Old } ? Omit<O, 'export'> & { readonly export: New } : O;

// ---- Host time: does any strict root reach a scoped registration? ----
type Captured<D> = { readonly captured: D };
type HostReach<R extends Registrations, C, D, Visited> = D extends keyof R ? D extends Visited ? never
  : Policy<R[D]> extends 'root' ? never
  : Policy<R[D]> extends 'scoped' ? Captured<D>
  : Policy<R[D]> extends 'alias' ? HostReach<R, C, AliasKey<R[D]>, Visited | D>
  : HostReaches<R, C, R[D], D, Visited | D> : never;
type HostFollow<R extends Registrations, C, X, Visited> = X extends { readonly kind: 'scoped'; readonly key: infer S } ? Captured<S>
  : X extends { readonly key: infer D } ? HostReach<R, C, D, Visited> : never;
type HostReaches<R extends Registrations, C, V extends Registration, K, Visited> =
  | HostReach<R, C, Dependencies<V>, Visited>
  | HostFollow<R, C, Carriers<C, K>['reach'], Visited>
  | (ProviderCollectionTokens<V> extends infer T ? T extends TokenBase
      ? HostFollow<R, C, ContributionReaches<C, T>, Visited>
        | (OwnContributions<C, T> extends infer W ? W extends Registration ? HostReaches<R, C, W, never, Visited> : never : never)
      : never : never);
type HostRootCaptives<R extends Registrations, C> = {
  [K in keyof R]: true extends Strict<R[K]> ? HostReaches<R, C, R[K], K, K> extends infer X ? X extends Captured<infer D>
    ? { readonly root: K; readonly dependency: D } : never : never : never;
}[keyof R];
type RetainedRootCaptives<R extends Registrations, C> = C extends RootObligation
  ? HostFollow<R, C, C['reach'], never> extends infer X ? X extends Captured<infer D> ? { readonly root: C['root']; readonly dependency: D } : never : never : never;
type Captives<R extends Registrations, C> = HostRootCaptives<R, C> | RetainedRootCaptives<R, C>;
type HostCaptiveText<O> = O extends { readonly root: infer Root; readonly dependency: infer D } ? `${NameText<Root>} -> ${NameText<D>}` : never;
/** Reject strict root providers that transitively capture scoped dependencies. */
export type CheckedLifetimes<R extends Registrations, C extends NeedConstraint> = [Captives<R, C>] extends [never] ? unknown
  : Unsatisfied<`root lifetime cannot capture scoped dependency: ${HostCaptiveText<Captives<R, C>>}`, { readonly captives: Captives<R, C> }>;
type OverrideCaptives<R extends Registrations, O extends Registrations, C> = {
  [K in keyof O & keyof R]: true extends Strict<R[K]> ? HostReaches<R, C, R[K], K, K> extends infer X ? X extends Captured<infer D>
    ? { readonly root: K; readonly dependency: D } : never : never : never;
}[keyof O & keyof R];
/** Reject root providers introduced by a scope override when they capture scoped dependencies. */
export type CheckedScopeLifetimes<R extends Registrations, O extends Registrations, C = never> = [OverrideCaptives<R, O, C>] extends [never] ? unknown
  : Unsatisfied<`root lifetime cannot capture scoped dependency: ${HostCaptiveText<OverrideCaptives<R, O, C>>}`, { readonly captives: OverrideCaptives<R, O, C> }>;
/** The effective caching policy of a public key, following aliases and exported carriers. */
export type CanonicalLifetime<R extends Registrations, K extends keyof R, C = never> = CanonicalPolicy<R, C, K>;
```

The former `CheckedLifetimes` deferred its captive report until the other build checks passed (`unknown extends CheckDependencyCompatibility<R> & ...`). Keep that guard: wrap the `Unsatisfied` branch of `CheckedLifetimes` exactly as the current file does, importing `CheckDependencyCompatibility`, `CheckDependencyCompleteness` from `./types` and `CheckedConstraints`, `CompleteConstraints` from `./module-types`.

- [ ] **Step 2: Route the obligations through sealing, renaming, replacing, and overriding**

In `src/module-types.ts`:
- `NeedConstraint`: replace the `LifetimeObligation` member's import so it refers to the new `LifetimeObligation` from `./lifetime-types` (the name is unchanged).
- `ModuleConstraints<R, P>`: remove `| PrivateLifetimes<R, P>` and add `| SealedLifetimes<R, P, C>` by giving the alias a third parameter `C extends NeedConstraint`; `ModuleSealedConstraints<E, C, P>` becomes `ModuleConstraints<RegistrationsFromEntries<E>, P, C> | SealedConstraints<C, RegistrationsFromEntries<E>, P>`.
- `SealedConstraints`: delete the `C extends LifetimeObligation ? EnclosedLifetimeObligation<...>` branch and add `C extends LifetimeObligation ? never` (the new obligations are produced by `SealedLifetimes`, which already re-scoped the retained ones).
- `RenamedConstraints`: replace the `RenamedLifetimeObligation` branch with `C extends LifetimeObligation ? RenamedObligation<C, Old, New>`.
- `ModulePublicProviders<R, P>`: change to `{ [K in P]: PublicProvider<R[K]> }` and delete `LexicalProvider`, `RenamedLifetimeProviders` usages; `Module.renameExport` in `src/module.ts` types its fourth argument as `RenamedLifetimeProviders<D, Old, New>` today: change that to `D` (the projection no longer depends on export names).
- `IncrementalConstraints`: keep as is; the `'lifetime'` kind literal in its `Extract` becomes `'root-reach' | 'carrier-reach' | 'contribution-reach'`.

In `src/contribution-types.ts`:
- `Contribution<T, V, L>` loses `L`; `ContributionConstraint = Contribution<TokenBase, Registration>`.
- `ModuleContributionConstraints<C, R, P>` returns `Contribution<C['token'], PublicProvider<C['registration']>> | RegistrationConstraints<C['registration'], R, P>`; the lexical branch is deleted.
- `RenamedContribution` returns `C` unchanged (contributions carry no export names).
- Update the `Contribution<...>` call sites in `BuilderContribute` accordingly.

In `src/scope-types.ts`:
- `Transients<R, S, C>` uses `CanonicalLifetime<R, K, C>`; `ScopeOptions<R, S, C = never>` threads `C`.
- Delete the `sharedAlias` and `lexical` branches of `PolicyGraph`/`PolicyTarget` (the file now only needs `CanonicalLifetime` from `./lifetime-types`), keep `UnsharedAliases`, `SharedAliasProviders`, `ScopedAliases` unchanged.

In `src/di-bag.ts`:
- `buildModule`: add `& SealAdmission<RegistrationsFromEntries<E>, Extract<SelectionKey<K[number]>, keyof RegistrationsFromEntries<E>>, C>` to the `keys` parameter type so a private captive is reported on the `buildModule` call.
- `replace` (both overloads): return `Builder<..., Exclude<C, { readonly kind: 'carrier-reach'; readonly export: K }>>` and use that narrowed constraint in the `CheckedConstraints` argument; a replaced export no longer carries the module's obligations.
- `fork(keys, overrides)` and `createScope(keys, overrides, options)`: pass `Exclude<C, { readonly kind: 'carrier-reach'; readonly export: SelectionKey<K[number]> }>` to `CheckedLifetimes` / `CheckedScopeLifetimes` and to the returned `Bag`'s constraint parameter.
- `createScope(options)` and the checked overload: `ScopeOptions<R, S, C>`.

In `src/index.ts`: remove `LexicalContext, ModuleScope, Enclosed, RenamedContext, EnclosedLifetimeObligation, RenamedLifetimeObligation, RenamedLifetimeProviders` from the lifetime-types export line and export `LifetimeObligation, Reach` instead; keep `CheckedLifetimes, CheckedScopeLifetimes`.

- [ ] **Step 3: Typecheck the library and iterate**

Run: `npm run typecheck`
Expected: after the edits above, remaining diagnostics are in the test fixtures, not in `src/`. Fix `src/` diagnostics first; do not add `any`.

- [ ] **Step 4: Run the lifetime and module fixtures**

Run: `bun test tests/types.test.ts -t "lifetime|module|nested|contribution|scope|erasure" tests/lifetime-declarations.test.ts tests/type-scale.test.ts tests/token-scale.test.ts`
Expected: the fixtures listed in Task 5 need marker moves; everything else passes. Iterate on `src/lifetime-types.ts` until `tests/types/nested-modules.ts`, `tests/types/lifetimes.ts`, `tests/types/lifetimes-consumer.ts`, `tests/types/contributions.ts`, `tests/types/selected-scopes-consumer.ts`, `tests/types/incremental-modules.ts`, and `tests/types/module-erasure/consumer.ts` compile clean.

- [ ] **Step 5: Commit**

```bash
git add src/lifetime-types.ts src/module-types.ts src/contribution-types.ts src/scope-types.ts src/di-bag.ts src/module.ts src/index.ts
git commit -m "feat: retain compact seal-time lifetime obligations instead of lexical contexts"
```

---

### Task 5: Move the seal-time markers and finish the negative fixtures

**Files:**
- Modify: `tests/types/negative/lifetimes.ts` (the `privateRoot` and `exportless` cases)
- Modify: `tests/types/negative/module-erasure.ts` (marker wording if the rendered names differ)

- [ ] **Step 1: Move markers that now fire at `buildModule`**

In `tests/types/negative/lifetimes.ts`, the `privateRoot` module (`hidden: withLifetime(({ db }) => db, 'root')` over a scoped private `db`) and the `exportless` module are rejected when sealed. Change

```ts
const privateRoot = DiBag.createBuilder().register({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root'), api: () => 1 }).buildModule(['api']);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(privateRoot).replace('api', withLifetime(() => 1, 'root')).build();

const exportless = DiBag.createBuilder().register({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root') }).buildModule([]);
// diagnostic: root lifetime cannot capture scoped dependency
DiBag.createBuilder().installModule(exportless).build();
```

to

```ts
const privateRootBuilder = DiBag.createBuilder().register({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root'), api: () => 1 });
// diagnostic: root lifetime cannot capture scoped dependency: hidden -> db
privateRootBuilder.buildModule(['api']);

const exportlessBuilder = DiBag.createBuilder().register({ db: () => 1, hidden: withLifetime(({ db }: { db: number }) => db, 'root') });
// diagnostic: root lifetime cannot capture scoped dependency: hidden -> db
exportlessBuilder.buildModule([]);
```

Every other marker in that file stays on its host `build()` line: the `privateCollision` case (exported transient `bridge` over a scoped private `db`, used by a host root) is a carrier reaching `scoped`, reported at the host as `root -> db`; the `renamed` case reaches `external` through a renamed carrier.

- [ ] **Step 2: Run every negative fixture and the declaration test**

Run: `bun test tests/types.test.ts tests/module-declarations.test.ts tests/type-scale.test.ts tests/token-scale.test.ts`
Expected: all PASS, including the three declaration assertions (no private names, size under budget, consumer compiles from the `.d.ts`).

- [ ] **Step 3: Run the runtime lanes and the native audit**

Run: `npm run typecheck && npm run test:fast && npm run test:compiler && npm run typecheck:native && npm run check:native`
Expected: PASS. The native audit will report gaps for the moved markers if `tests/native-diagnostic-markers.ts` pins the old lines; update those expectations to the new lines and messages.

- [ ] **Step 4: Commit**

```bash
git add tests/types/negative/lifetimes.ts tests/types/negative/module-erasure.ts tests/native-diagnostic-markers.ts
git commit -m "test: report private root captives when a module seals"
```

---

### Task 6: Measurements, docs, changelog

**Files:**
- Modify: `docs/guides/tutorial.md` ("Reuse named modules": the paragraph beginning "Private providers keep their external requirements")
- Modify: `docs/guides/api-reference.md` (`### Graph composition support types` table; remove the deleted names, add `LifetimeObligation`, `Reach`)
- Modify: `docs/benchmarks/typescript.md` (a short "Module declarations" subsection)
- Modify: `CHANGELOG.md`
- Regenerate: `docs/reference/**`

- [ ] **Step 1: Measure**

Run the named-module scale case before and after (use a worktree at the Task 1 commit for "before"):

```sh
bun test tests/type-scale.test.ts -t "named modules: valid" 2>&1 | grep -E "\[[0-9.]+m?s\]"
```

Record the `named modules: valid` duration before and after, and the `feature.d.ts` byte size from `tests/module-declarations.test.ts` before (Task 1 commit message) and after.

- [ ] **Step 2: Tutorial**

Replace the paragraph

```markdown
Private providers keep their external requirements, including requirements from
providers that are not currently reachable from an export. The host may satisfy
them later with `register`, another installation, or a forward registration before
`build()`. Each installation gets fresh private binding identities and ownership.
```

with

```markdown
Private providers keep their external requirements, including requirements from
providers that are not currently reachable from an export. The host may satisfy
them later with `register`, another installation, or a forward registration before
`build()`. Each installation gets fresh private binding identities and ownership.

A sealed module's type retains only what the host needs: the exported services,
the external requirements, the needs private consumers have on exports, and
compact lifetime obligations that say which export or external keys each root and
each exported transient or alias reaches. Private names and types do not appear
in a library's emitted declarations. A root that would capture a scoped service
inside the same module is rejected by `buildModule`; a root that reaches a
scoped service through an export or a requirement is rejected by the host's
`build()`, naming both ends.
```

- [ ] **Step 3: Reference tables, benchmarks note, changelog**

In `docs/guides/api-reference.md` `### Graph composition support types`, remove the rows for `LexicalContext`, `ModuleScope`, `Enclosed`, `RenamedContext`, `EnclosedLifetimeObligation`, `RenamedLifetimeObligation`, `RenamedLifetimeProviders`, and add:

```markdown
| `LifetimeObligation`, `Reach` | Compact seal-time records of which export or external keys a module's roots, exported carriers, and contributions reach. |
```

In `docs/benchmarks/typescript.md`, add after "## Supported scale":

```markdown
### Module declarations

Sealed modules print resolved export and requirement objects and compact lifetime
obligations. `tests/module-declarations.test.ts` keeps a three-export module's
emitted declaration under 2,500 bytes and free of private names; the recorded
size on 2026-09-13 before this change was <before> bytes.
```

Fill in `<before>` from Task 1.

Under `## Unreleased` in `CHANGELOG.md`, add a `### Breaking changes` subsection if absent, then:

```markdown
- Sealed module types no longer retain private registrations. Emitted declarations
  print resolved exports and requirements and compact lifetime obligations. A root
  that captures a scoped service inside its own module is now rejected by
  `buildModule` instead of the host's `build()`. The type-only exports
  `LexicalContext`, `ModuleScope`, `Enclosed`, `RenamedContext`,
  `EnclosedLifetimeObligation`, `RenamedLifetimeObligation`, and
  `RenamedLifetimeProviders` are removed; `LifetimeObligation` and `Reach` replace them.
```

- [ ] **Step 4: Regenerate, check, commit**

Run: `npm run docs:generate && npm run docs:check && npm run check && npm run check:native`
Expected: PASS; `docs/reference/api-coverage.json` drops the removed names and adds the new ones.

```bash
git add docs CHANGELOG.md
git commit -m "docs: describe compact sealed module types"
```

## Status

Recorded 2026-09-13. The fallback was delivered on the plan branch; the full implementation is kept on the local
branch `plan-07-module-erasure-full` for the maintainer's decision.

### What the plan branch contains

- Task 1: the characterization fixtures (`tests/types/module-erasure/*`, `tests/types/negative/module-erasure.ts`)
  and `tests/module-declarations.test.ts`, with the assertions that need Tasks 2 to 5 skipped (each skip points here).
  The seal-time negative case is not in the fixture, because without Task 4 the capture is reported at the host.
- No `src/` change. Tasks 2 and 3 on their own push the `100 installed token modules` ceiling in
  `tests/incremental-scale.test.ts` over its limit (see below), so they are not on the plan branch either.

### What `plan-07-module-erasure-full` achieves

Every type fixture, every negative marker, the three declaration assertions, the package suites, and the native audit
(`accepted-with-diagnostic-gaps`, only the reviewed gap) pass there. The characterization declaration drops from 6,815 bytes to 2,095 bytes and names no private registration
or private type. Design, as implemented (it differs from the Task 4 sketch):

- Exports, requirements, constraint needs, and public providers print resolved. Helpers must answer through a resolved
  conditional branch: an alias exported from a source file but not from the package index fails consumer emit with
  TS2742, and union, mapped, and indexed-access aliases keep their names through instantiation (so a union built from
  them prints through them, which is how `ModuleConstraints<RegistrationsFromEntries<...>>` kept leaking).
  Symbol keys stay `Record` references: emit cannot serialize an expanded unique-symbol property even for an exported key.
- Lifetime obligations are seal-time reach records: `root-reach` (private strict roots), `export-reach` (exported
  strict roots, transients, aliases; dropped by `replace`, `fork` and `createScope` overrides of that key, renamed with
  it), `contribution-reach` (root or transient contributions). Collections stay unresolved (`collection` reach) because
  the host completes them.
- Exported strict roots do not fail at seal time: `tests/types/lifetimes.ts` replaces such an export in the host.
  Only roots nobody can replace (private roots, root contributions) fail at `buildModule`.
- Exported aliases to private targets take the target's lifetime in the projected provider; aliases to exports or
  externals keep the target name, renamed with `renameExport`.
- `sharedAlias` routing for selected child scopes is kept in the host walk.
- A cheap gate skips all lifetime walks for graphs with no lifetime, alias, retained obligation, or lifetime contribution.

### Remaining failure: compiler-work ceilings

`tests/incremental-scale.test.ts` on `plan-07-module-erasure-full` (tip `fdbcf50` in parentheses):

| Case | Ceiling | Full plan 07 | Tip |
|---|---|---|---|
| 100 named additions | 790,000 | 787,385 | 765,037 |
| 100 named replacements | 1,030,000 | 1,030,831 (fails) | 1,006,954 |
| 100 token bindings | 850,000 | 846,818 | 824,964 |
| 100 installed token modules | 1,220,000 | 1,241,108 (fails) | 1,215,919 |

Tasks 1 to 3 alone, with the cheaper single-kind export form, measure 1,223,280 on the token-module case.
The `1000 providers from reusable named modules` cases stay green on the full branch (three cases 83.0 s, against
45.5 s measured on the base before Task 1, on a busier machine).

Attribution on the full implementation (instantiations saved by removing one piece, 100 token modules): resolved
exports 6.0k, sealed lifetime obligations 6.7k (of which the gate itself about 5k), projected public providers 4.8k,
seal admission 3.3k, host lifetime check 3.1k.

### Approaches tried

1. The plan's Task 4 sketch: seal-time failure for every strict root (breaks `lifetimes.ts` replacement of an exported
   root), `Extract<...>['reach']` indexing (TS2536 in generic context), and unexported aliases assumed to expand in emit
   (TS2742 in the packed consumer).
2. Distributive `Flatten` over the sealed constraint union: a conditional reached through a generic signature is
   instantiated without its alias, so an unchanged union keeps its origin. Replaced by resolved-conditional bodies for
   `RegistrationConstraints` and `ModuleConstraints`.
3. Cost reduction: gate on `R[keyof R]` (−51k), per-key gate (+1.6k, dropped), seal admission on `this` (−0.2k,
   dropped), `infer I extends object` symbol parts (+4k, dropped), mapped symbol parts (−3k each, but emit cannot
   serialize them), direct `Record` fast paths (−3k at best, incorrect for several symbols).

### What to try next

- Decide whether the declaration-size and private-edit invalidation wins justify raising the two ceilings by about
  1k and 22k; the maintainer owns that tradeoff.
- Otherwise, move erasure out of the per-install type path: keep `Module` parameters lazy (the old `Pick` and
  lexical forms) and add an explicit `sealed()` or `ModuleContract<typeof m>` projection that libraries opt into for
  their exported declarations, so only emitted modules pay.
- Make the lifetime gate reuse a check the builder already computes per registration.
