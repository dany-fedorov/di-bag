# Dependency Proxy Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `'x' in deps`, `Object.keys(deps)`, `{ ...deps }`, `JSON.stringify(deps)`, and descriptor inspection on a factory's dependency object throw a structured error instead of silently returning nothing.

**Architecture:** The dependency object handed to a factory is a `Proxy` over a null-prototype target with only a `get` trap (`src/acquisition.ts`). Three more traps (`has`, `ownKeys`, `getOwnPropertyDescriptor`) throw `DI_BAG_INVALID_DEPENDENCY_ACCESS` naming the consumer. Destructuring and direct reads use only `get`, so they keep working.

**Tech Stack:** TypeScript, bun:test.

**Spec:** `docs/superpowers/specs/2026-09-13-agentic-scale-hardening.md` (decision D4)

## Global Constraints

- Minimum supported TypeScript 6.0.3; `npm run check:native` must keep passing.
- Zero runtime, peer, optional, and bundled dependencies.
- `npm run check` passes before every commit.
- Library errors are created only through `libraryError` in `src/errors.ts` with a `DI_BAG_*` code and frozen `details`.
- Commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

---

### Task 1: Throwing traps on the dependency Proxy

**Files:**
- Modify: `src/acquisition.ts:188-197` (the `const deps = new Proxy(...)` block inside `resolveBinding`)
- Test: `tests/dependency-proxy.test.ts` (new)

**Interfaces:**
- Produces: error code `'DI_BAG_INVALID_DEPENDENCY_ACCESS'` with `details: { operation: 'resolve', consumer: string, access: string }`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/dependency-proxy.test.ts
import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';

type Logger = { log(message: string): void };

test('destructuring, direct reads, and positional adapters keep working', async () => {
  const key = Symbol('logger');
  const loggerToken = DiBag.token(key).of<Logger>();
  const bag = DiBag.createBuilder()
    .register(loggerToken, () => ({ log() {} }))
    .register({
      logger: (): Logger => ({ log() {} }),
      direct: (deps: { logger: Logger }) => typeof deps.logger.log,
      destructured: ({ logger }: { logger: Logger }) => typeof logger.log,
      positional: DiBag.fromFunction([loggerToken], logger => typeof logger.log),
    })
    .build();
  expect(bag.resolve('direct')).toBe('function');
  expect(bag.resolve('destructured')).toBe('function');
  expect(bag.resolve('positional')).toBe('function');
  await bag.close();
});

const accesses: ReadonlyArray<readonly [string, (deps: object) => unknown, string]> = [
  ["the 'in' operator", deps => 'logger' in deps, "'logger' in deps"],
  ['Object.keys', deps => Object.keys(deps), 'enumeration'],
  ['spread', deps => ({ ...deps }), 'enumeration'],
  ['JSON.stringify', deps => JSON.stringify(deps), 'JSON.stringify'],
  ['Object.getOwnPropertyDescriptor', deps => Object.getOwnPropertyDescriptor(deps, 'logger'), "descriptor of 'logger'"],
];

for (const [name, access, fragment] of accesses) test(`${name} on the dependency object throws DI_BAG_INVALID_DEPENDENCY_ACCESS`, async () => {
  let calls = 0;
  const bag = DiBag.createBuilder().register({
    logger: (): Logger => ({ log() {} }),
    probe: (deps: { logger: Logger }) => { calls++; return access(deps); },
  }).build();
  let caught: unknown;
  try { bag.resolve('probe'); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(Error);
  const { code, details, message } = caught as Error & { code: string; details: Record<string, unknown> };
  expect(code).toBe('DI_BAG_INVALID_DEPENDENCY_ACCESS');
  expect(details.consumer).toBe('probe');
  expect(details.operation).toBe('resolve');
  expect(message).toContain('"probe"');
  expect(message).toContain(fragment);
  // The failed attempt is evicted: a corrected factory would run again on the next resolve.
  expect(calls).toBe(1);
  expect(bag.inspect('probe').acquisitions).toEqual([]);
  await bag.close();
});

test('enumeration inside a fork override is rejected the same way', async () => {
  const root = DiBag.createBuilder().register({ value: () => 1, reader: ({ value }: { value: number }) => value }).build();
  const fork = root.fork(['reader'], { reader: (deps: { value: number }) => Object.keys(deps).length });
  expect(() => fork.resolve('reader')).toThrow('enumeration (Object.keys, spread, JSON.stringify) is not supported');
  await fork.close();
  await root.close();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/dependency-proxy.test.ts`
Expected: the first test passes; every access test fails because `bag.resolve('probe')` returns `false`, `[]`, `{}`, `'{}'`, or `undefined` instead of throwing.

- [ ] **Step 3: Add the traps**

In `src/acquisition.ts`, replace the `const deps = new Proxy(...)` statement (currently lines 189-197) with:

```ts
    const invalidAccess = (access: string) => libraryError(
      'DI_BAG_INVALID_DEPENDENCY_ACCESS',
      `Cannot inspect the dependencies of ${JSON.stringify(attempt.label)}: ${access} is not supported. Read each named dependency directly; the dependency object resolves lazily.`,
      { operation: 'resolve', consumer: attempt.label, access },
    );
    const deps = new Proxy(Object.create(null) as Record<string, unknown>, {
      get: (_, key) => {
        // JSON.stringify probes toJSON through get before enumerating; name the real operation.
        if (key === 'toJSON') throw invalidAccess('JSON.stringify');
        const reference = typeof key === 'symbol' ? references.get(key) : undefined;
        if (reference) return reference.kind === 'lazy' ? () => read(reference.key)
          : read(reference.key, reference.kind === 'optional', reference.kind === 'all');
        if (typeof key === 'symbol' && !description.tokenKeys.includes(key)) return undefined;
        return read(key);
      },
      // Only `get` is lazy and checked; every other reflection would silently report an empty object.
      has: (_, key) => { throw invalidAccess(`'${String(key)}' in deps`); },
      ownKeys: () => { throw invalidAccess('enumeration (Object.keys, spread, JSON.stringify)'); },
      getOwnPropertyDescriptor: (_, key) => { throw invalidAccess(`descriptor of '${String(key)}'`); },
    });
```

`libraryError` is already imported at the top of `src/acquisition.ts`.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/dependency-proxy.test.ts`
Expected: all PASS. If the `message` assertions fail on quoting, match the exact `JSON.stringify(attempt.label)` output (`"probe"` with double quotes).

- [ ] **Step 5: Confirm console inspection does not throw in either host**

Run:

```sh
node -e "const {DiBag}=require('./dist/node.js');" 2>/dev/null; bun -e "
import { DiBag } from './src/node';
const bag = DiBag.createBuilder().register({ a: () => 1, probe: (deps: { a: number }) => { console.log(deps); return deps.a; } }).build();
console.log(bag.resolve('probe'));
"
```

Expected: Bun prints `[Object: null prototype] {}` and then `1`, without an error (validated 2026-09-13). Node's `util.inspect` reads the Proxy target directly and never invokes traps. If Bun's inspector throws, add `Symbol.for('nodejs.util.inspect.custom')` handling in the `get` trap returning `() => '[di-bag dependencies]'` and retest; do not weaken the throwing traps.

- [ ] **Step 6: Run the fast lane and typecheck, then commit**

Run: `npm run typecheck && npm run test:fast`
Expected: PASS (if plan 01 is not merged yet, run `bun test tests` instead).

```bash
git add src/acquisition.ts tests/dependency-proxy.test.ts
git commit -m "feat: reject enumeration of the dependency object"
```

---

### Task 2: Document the rule

**Files:**
- Modify: `docs/guides/tutorial.md` (the "Compose services" section, after the paragraph beginning "Factories are called without a `this` receiver.")
- Modify: `docs/guides/api-reference.md` (the "Errors and recovery" section, the paragraph mentioning `DI_BAG_*` codes)
- Modify: `CHANGELOG.md` (under `## Unreleased`)

- [ ] **Step 1: Add the tutorial paragraph**

Insert after the paragraph that ends "A factory is still borrowed by default even if its result has a method called `close` or `dispose`.":

```markdown
The dependency object is a lazy view, not a plain record. Reading a property
acquires that dependency; destructuring in the parameter list is the usual way
to do it. Testing `'name' in deps`, calling `Object.keys(deps)`, spreading
`{ ...deps }`, or serializing it with `JSON.stringify` throws
`DI_BAG_INVALID_DEPENDENCY_ACCESS`, because those operations would otherwise
report an empty object. Read every dependency by name.
```

- [ ] **Step 2: Add the API reference sentence**

In `docs/guides/api-reference.md`, in the paragraph of the "Errors and recovery" section that says library-created failures expose stable `DI_BAG_*` codes, append the sentence:

```markdown
`DI_BAG_INVALID_DEPENDENCY_ACCESS` reports enumeration or `in` checks on a factory's dependency object; its `details.consumer` names the factory.
```

- [ ] **Step 3: Add the changelog entry**

Under `## Unreleased` in `CHANGELOG.md` (create the heading above `## 0.1.1` if absent), add:

```markdown
- A factory's dependency object now throws `DI_BAG_INVALID_DEPENDENCY_ACCESS`
  for `in`, `Object.keys`, spread, `JSON.stringify`, and descriptor reads instead
  of silently reporting an empty object. Destructuring and direct reads are unchanged.
```

- [ ] **Step 4: Check the docs and commit**

Run: `npm run docs:check`
Expected: PASS (requires `npm ci --prefix tools/docs` once).

```bash
git add docs/guides/tutorial.md docs/guides/api-reference.md CHANGELOG.md
git commit -m "docs: explain dependency object access rules"
```
