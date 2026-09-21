# Non-Breaking Names (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename every name in the library that a reader sees but a caller never writes: abbreviated parameter names, callback parameters called `value`, and the single-letter type parameters of the five exported classes, and guard the API card's summaries with a test.

**Architecture:** Nothing a caller types changes, so there is no expand, migrate or contract step and the codemod is not used. Two one-off Python scripts make the mechanical edits; each accepts only the complete state before its task or the complete state after it and rejects a partially applied state before writing. Tasks 1 to 4 start with a failing assertion in an existing test harness (the reference-rendering test under `tools/docs/test`, a compiler fixture, or a new source scan), then apply the edit, regenerate the API card and reference, and commit. Task 5 closes the phase with the ratchet, evidence and full gates.

**Tech Stack:** TypeScript 6.0.2 (`tsc6`) and 7.0.2 (`tsc`), Bun 1.4.0 test runner, Node 24.20.0 with `node --test` for `tools/docs`, TypeDoc under `tools/docs`, Python 3 for the two edit scripts.

**Spec:** `docs/superpowers/specs/2026-09-20-swift-api-style.md` (standard rules 5, 7 and 13; section "Exported types", last paragraph; roadmap phase 2). Master plan: `docs/superpowers/plans/2026-09-21-00-swift-api-style-master.md`, phase 2. Read both before starting. The controller corrects the exported-generic paragraph in the spec before this phase starts; the entry check asserts the corrected text. The spec then wins on names.

## Global Constraints

Copied from the master plan. Every task's requirements include them.

- This phase is non-breaking. No public method name, option key, string value, error code, runtime message or behavior changes. If an edit would change what a caller writes or what a program prints, stop and report.
- The package keeps zero runtime dependencies, and `src/index.ts` must not import a `node:` module.
- The phase ends green on all of: `npm run check`, `npm run docs:check`, `npm run graph:check`, `npm run codemod:check`, the three Node retention suites in the master plan, `npm run agent-eval:test`, `npm run typecheck:native`, `npm run build:native`, `npm run check:native`, and every `examples/*.ts` run with Bun. The example loop is fail-fast. The authoritative compile-budget command is `node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md`.
- Compile budget: instantiation counts of the twelve benchmark worker cases stay within +10% of `docs/superpowers/plans/evidence/baseline.md`. Renaming cannot change them, so this phase expects 0%.
- `AGENTS.md` has a budget of 150 lines and is at 150 lines. Edits there replace text inside a line and never add a line.
- Commits use Conventional Commits and end with the two attribution lines shown in each commit step. Commit on the phase branch only. Never push, publish, merge, or switch away from the phase branch.
- Never delete or skip a test to get green. Never weaken a negative fixture.

## Environment

Run every command from the repository root:

```bash
export PATH="<the directory that holds Bun 1.4.0>/bin:$PATH"
export npm_config_update_notifier=false
bun --version   # must print 1.4.0
node --version  # must print v24.20.0
```

If that Bun is missing, install it with `curl -fsSL https://bun.sh/install | BUN_INSTALL=<dir> bash -s "bun-v1.4.0"` and put `<dir>/bin` first on `PATH`.

## State on entry

Phases 0 and 1 are merged into `next`:

- `docs/guides/api-naming.md` holds the naming standard.
- A naming test, `tests/api-naming*.test.ts`, reads the built declarations and compares what it finds with the ratchet list `tests/api-naming-known-violations.json`.
- `docs/superpowers/plans/evidence/baseline.md` holds the instantiation counts of the twelve benchmark worker cases.
- `tools/codemod/` exists. This phase does not use it.
- The spec's "Exported types" paragraph already names `Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue>`, `Container<ServiceRegistrations, Constraints>`, `Builder<Entries, Constraints>`, `Module<ExportedServices, RequiredServices, Constraints, PublicProviders>` and `Token<TokenSymbol, Service>` and explains the three imported-type collisions. The controller owns and lands that correction before this phase; the phase executor never edits or stages the spec.
- Neither phase touched `src/`. The library source is still the 0.4.0 source, last changed by commit `f8300e2`.

The names this phase meets, verified against the source on 2026-09-21:

| Where | Today |
| --- | --- |
| `src/acquisition-context.ts`, `src/acquisition.ts`, `src/provider-execution.ts` | parameters `factoryCtx` and `disposerCtx` (10 lines in `src`) |
| ten files under `src/` | parameter or local `deps` (24 lines) |
| `AGENTS.md`, `docs/agent/recipes.md`, `docs/agent/errors.md` | `factoryCtx`, `disposerCtx`, `deps`, `_deps` (13 lines) |
| `src/registration.ts`, `src/provider.ts`, `src/acquisition-mode.ts`, `src/plugins.ts` | callback parameters called `value` in public signatures |
| `src/provider.ts` | `class Provider<F, M, A, G, V>` |
| `src/di-bag.ts` | `class Bag<R, C>` and `class Builder<E, C>` |
| `src/module.ts` | `class Module<P, R, C, D>` |
| `src/tokens.ts` | `class Token<K, S>` |

### Tests that pin text this phase changes

Emitted declarations and rendered reference pages print parameter names and type parameter names, so four places pin them. Each is updated in the task that changes the name.

| Pin | Text | Task |
| --- | --- | --- |
| `tools/docs/test/exact-rendering.test.mjs:54` | `inspect<K extends (keyof R & string) …TokenMember<R, K>` | 3 |
| `tools/docs/test/exact-rendering.test.mjs:67` | `isNativePromise: (this: void, value: unknown) => boolean` | 2 |
| `tests/types/negative/startup.ts:53` | the expected diagnostic quotes `(this: void, disposerCtx: DisposerContext) => void \| Promise<void>` | 1 |
| `tests/types/startup.ts:45` | mirrors the `pushDisposer` parameter list; the assertion holds either way, because parameter names are not part of a type | 1 |

Checked and not affected: `tests/module-declarations.test.ts` (pins private names only), `tests/native-package.test.ts`, `tests/package.test.ts` and `tests/release-artifacts.test.ts` (no type parameter or parameter name of the library appears in an expectation), `tests/types/module-erasure/`, `tools/graph/lib/extract.mjs` (reads type arguments by position), and `tests/native-diagnostic-markers.ts`, whose two pinned messages quote the fixtures' own `_deps` and `_factoryCtx`, which stay. No file in the repository stores a hash of `dist/`.

## Decisions made by this plan

**Parameter names.**

| Today | After | Where |
| --- | --- | --- |
| `factoryCtx` | `factoryContext` | every file under `src/`, agent docs |
| `disposerCtx` | `disposerContext` | every file under `src/`, agent docs |
| `deps` in a signature or in JSDoc | `dependencies` | `acquisition-context.ts`, `alias-types.ts`, `provider.ts`, `types.ts`, `registration.ts`, `di-bag.ts`, agent docs |
| `deps` as the runtime local that holds the dependency proxy | `dependencyProxy` | `acquisition.ts`, `provider-execution.ts`, `composition.ts`, `plugins.ts`. `plugins.ts` already has a parameter called `dependencies` in the enclosing function, so `dependencies` would shadow it |
| `_deps` in agent doc snippets | `_dependencies` | `docs/agent/errors.md` |
| disposer callback `value` | `acquiredValue` | `withDisposal`, both overloads. It is the glossary's "acquired value" and the fifth type parameter of `Provider` |
| `transformService` and `withMetadata` callback `value`, direct mode | `exposedService` | matches the spec's `'exposed-service'` |
| `transformService` and `withMetadata` callback `value`, awaited mode | `fulfilledValue` | matches the spec's `'fulfilled-value'` |
| `RuntimeOptions.isNativePromise(value)` | `candidate` | the value being classified |
| `PluginOutputValidator` parameter `value` | `pluginOutput` | a type predicate compares parameters by position, so callers that wrote `(value): value is T` still type-check. Verified with `tsc6` |

**Type parameters.** Three obvious role names are imported types in the same file. A type parameter called `Factory` with the constraint `extends Factory` does not compile: `error TS2313: Type parameter 'Factory' has a circular constraint` (verified with `tsc6`). The controller corrects the spec before phase entry to use the collision-free role names below; task 3 asserts that correction and does not edit the spec.

| Class | Today | After |
| --- | --- | --- |
| `Provider` | `F, M, A, G, V` | `ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue` |
| `Bag` | `R, C` | `ServiceRegistrations, Constraints` |
| `Builder` | `E, C` | `Entries, Constraints` |
| `Module` | `P, R, C, D` | `ExportedServices, RequiredServices, Constraints, PublicProviders` |
| `Token` | `K, S` | `TokenSymbol, Service` |

Only the class declarations and the uses inside each class body change. Type parameters of methods, functions and helper types keep their letters. Inside `Builder`, `installModule` declares its own `R`; it stays.

**Summaries.** Every call summary in the API card already starts with one of a compact reviewed set of imperative verbs. Five contain "or". `DiBag.fromFactory` and `DiBag.withMetadata` really join two purposes; phases 8 and 9 split those calls, so their summaries stay. `DiBag.withLifetime` lists its values and `builder.alias` lists key kinds; phases 9 and 5 rewrite them with the calls. `bag.resolve` survives to 0.5.0 with the same meaning, so its summary is rewritten now. The master explicitly permits the other four as a staged ratchet: `builder-alias` is removed in phase 5, `dibag-fromfactory` in phase 8, and `dibag-withlifetime` plus `dibag-withmetadata` in phase 9. The test rejects any new exception and any stale recorded exception; final acceptance still requires an empty list.

## What this phase does not touch

- `src/acquisition.ts` keeps the runtime message text `'<key>' in deps`. It is printed to users, is carried in `details.access`, and `tests/dependency-proxy.test.ts` pins it. Message text is behavior. Phase 11 rewrites messages.
- Parameter names that callers chose: everything under `tests/` and `examples/`, including the fixture-local `factoryCtx`, `_deps` and `_disposerCtx` in `tests/types/negative/*.ts`. `tests/native-diagnostic-markers.ts` pins two native messages that quote those fixture-local names, so renaming them would break it for no gain.
- `docs/guides/*.md` and `README.md`. Phase 12 rewrites them.
- The implementation signatures of overloaded functions (`withDisposal`, `transformService`, `withMetadata`), the internal `annotate` helper, `src/provider-operations.ts`, the ambient `require` declaration in `src/node.ts`, and the `(value: …) => …` invariance witnesses. None of them reaches a reader of the public API.
- `docs/reference/api-coverage.json` and `tools/docs/api-card-tasks.json`. They hold export names, overload counts and call names, none of which change.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `/tmp/di-bag-phase-02/phase2_renames.py` | create, not committed | the mechanical edits to `src/` and the agent docs, in three steps |
| `/tmp/di-bag-phase-02/rendering_test_edits.py` | create, not committed | the exact edits to the reference-rendering test, in three steps |
| `tests/documented-names.test.ts` | create | fast-lane scan: no abbreviated parameter name in `src/` or the agent docs |
| `tools/docs/test/exact-rendering.test.mjs` | modify | pins the rendered signatures: parameter names, callback names, class type parameters |
| `tools/docs/test/api-card-summaries.test.mjs` | create | the "or" test and the verb test over `docs/agent/api-card.md` |
| `tools/docs/api-card-summary-exceptions.json` | create | the recorded exceptions of that test |
| `tests/types/negative/startup.ts` | modify line 53 | the one expected diagnostic that quotes a library parameter name |
| `tests/types/startup.ts` | modify line 45 | mirrors the `pushDisposer` signature |
| `src/*.ts` (14 files) | modify | the renames |
| `AGENTS.md`, `docs/agent/recipes.md`, `docs/agent/errors.md` | modify | the same names in prose and snippets |
| `docs/agent/api-card.md`, `docs/reference/**` | regenerate | output of `npm run docs:generate`; never edit by hand |
| `docs/superpowers/specs/2026-09-20-swift-api-style.md` | assert only; never modify or stage | controller-owned entry condition: the final type parameter names |
| `tests/api-naming-known-violations.json` | shrink | the ratchet of phase 0 |
| `docs/superpowers/plans/evidence/phase-02.md` | create | measurements and the names later phases meet |

---

### Task 0: Branch, entry check, and the two edit scripts

**Files:**
- Create: `/tmp/di-bag-phase-02/phase2_renames.py`
- Create: `/tmp/di-bag-phase-02/rendering_test_edits.py`

**Interfaces:**
- Consumes: branch `next` with phases 0 and 1 merged.
- Produces: `python3 /tmp/di-bag-phase-02/phase2_renames.py "$PWD" <params|callbacks|generics>` and `python3 /tmp/di-bag-phase-02/rendering_test_edits.py "$PWD" <task1|task2|task3>`, used by tasks 1 to 3.

- [ ] **Step 1: Create the phase branch**

```bash
git switch next
git status --short          # expected: no output
git switch -c phase-02-non-breaking-names
```

- [ ] **Step 2: Confirm the state on entry**

```bash
ls docs/guides/api-naming.md tests/api-naming-known-violations.json tools/codemod/cli.mjs docs/superpowers/plans/evidence/baseline.md
ls tests/api-naming*.test.ts
node -e "const { scripts } = require('./package.json'); if (!scripts['codemod:check']) throw new Error('phase 1 codemod:check script is missing')"
grep -F 'Generic parameters get role names: `Provider<ExposedFactory, RegistrationMetadata,' docs/superpowers/specs/2026-09-20-swift-api-style.md
grep -F '`Container<ServiceRegistrations, Constraints>`, `Builder<Entries, Constraints>`,' docs/superpowers/specs/2026-09-20-swift-api-style.md
grep -F '`Token<TokenSymbol, Service>`. `Factory`, `GraphContract` and `Registrations` are' docs/superpowers/specs/2026-09-20-swift-api-style.md
grep -rnE 'factoryCtx|disposerCtx' src | wc -l                                                        # expected: 10
grep -rnE '\bdeps\b' src | wc -l                                                                     # expected: 24
grep -nE '\b(factoryCtx|disposerCtx|deps|_deps)\b' AGENTS.md docs/agent/recipes.md docs/agent/errors.md | wc -l   # expected: 13
grep -cE '\b(factoryCtx|disposerCtx|deps|_deps)\b' docs/agent/api-card.md                            # expected: 0
wc -l AGENTS.md                                                                                       # expected: 150
```

Every command must succeed. The three spec lines prove that the controller-owned correction landed before the executor branched; do not edit the spec in this phase. If a count differs, an earlier phase touched these files: read the difference with `git log --oneline -5 -- src AGENTS.md docs/agent` and report before continuing. The scripts below also check their own complete before/after states and stop without writing when the source differs or a task is only partly applied.

- [ ] **Step 3: Write the rename script**

```bash
mkdir -p /tmp/di-bag-phase-02
```

Create `/tmp/di-bag-phase-02/phase2_renames.py` with exactly this content:

```python
#!/usr/bin/env python3
"""Phase 2 mechanical renames.

Usage: python3 phase2_renames.py <repo-root> <params|callbacks|generics>
Every step checks what it expects to find and stops without writing when the source differs.
Every step is idempotent: a second run reports no change.
"""
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
step = sys.argv[2]
src = root / 'src'
changed = set()


def rewrite(path, new_text):
    if path.read_text() != new_text:
        path.write_text(new_text)
        changed.add(str(path.relative_to(root)))


def require_uniform(states, label):
    kinds = {state for state in states}
    if kinds == {'before'}:
        return True
    if kinds == {'after'}:
        return False
    sys.exit(f'{label}: mixed or partially applied state: {states}')


def scoped_lines(text, keep_fragment):
    return [line for line in text.split('\n') if keep_fragment is None or keep_fragment not in line]


def word_count(text, word, keep_fragment=None):
    return sum(len(re.findall(r'\b%s\b' % re.escape(word), line)) for line in scoped_lines(text, keep_fragment))


def word_state(rule):
    name, old, new, expected_old, expected_new_before, keep_fragment = rule
    text = (root / name).read_text()
    actual = (word_count(text, old, keep_fragment), word_count(text, new, keep_fragment))
    before = (expected_old, expected_new_before)
    after = (0, expected_new_before + expected_old)
    if actual == before:
        return 'before'
    if actual == after:
        return 'after'
    sys.exit(f'{name}: expected {old!r}/{new!r} counts {before} before or {after} after, found {actual}')


def apply_word_rule(rule):
    name, old, new, _expected_old, _expected_new_before, keep_fragment = rule
    path = root / name
    lines = path.read_text().split('\n')
    rewrite(path, '\n'.join(
        line if keep_fragment is not None and keep_fragment in line else re.sub(r'\b%s\b' % re.escape(old), new, line)
        for line in lines
    ))


def exact_state(rule):
    name, old, new, count = rule
    text = (root / name).read_text()
    actual = (text.count(old), text.count(new))
    before = (count, 0)
    # Some replacements insert text before an unchanged suffix, so `old` can be a substring of `new`.
    after = (count * new.count(old), count)
    if actual == before:
        return 'before'
    if actual == after:
        return 'after'
    sys.exit(f'{name}: expected exact counts {before} before or {after} after, found {actual} for {old!r}')


def apply_exact_rule(rule):
    name, old, new, _count = rule
    path = root / name
    rewrite(path, path.read_text().replace(old, new))


def params():
    # Each tuple is path, old word, new word, old count before, new count before, kept-line fragment.
    # Existing full words such as `dependencies` are counted rather than assumed absent.
    rules = [
        ('src/acquisition-context.ts', 'factoryCtx', 'factoryContext', 5, 0, None),
        ('src/acquisition-context.ts', 'disposerCtx', 'disposerContext', 2, 0, None),
        ('src/acquisition.ts', 'disposerCtx', 'disposerContext', 1, 0, None),
        ('src/provider-execution.ts', 'disposerCtx', 'disposerContext', 3, 0, None),
        ('src/acquisition-context.ts', 'deps', 'dependencies', 6, 3, None),
        ('src/alias-types.ts', 'deps', 'dependencies', 1, 0, None),
        ('src/provider.ts', 'deps', 'dependencies', 2, 5, None),
        ('src/types.ts', 'deps', 'dependencies', 3, 1, None),
        ('src/registration.ts', 'deps', 'dependencies', 1, 1, None),
        ('src/di-bag.ts', 'deps', 'dependencies', 1, 8, None),
        # The proxy's `in` trap quotes "'<key>' in deps" in behavior and is excluded from both counts and writes.
        ('src/acquisition.ts', 'deps', 'dependencyProxy', 3, 0, ' in deps`'),
        ('src/provider-execution.ts', 'deps', 'dependencyProxy', 3, 0, ' in deps`'),
        ('src/composition.ts', 'deps', 'dependencyProxy', 4, 0, ' in deps`'),
        ('src/plugins.ts', 'deps', 'dependencyProxy', 2, 0, ' in deps`'),
        ('AGENTS.md', 'factoryCtx', 'factoryContext', 1, 0, None),
        ('AGENTS.md', 'disposerCtx', 'disposerContext', 1, 0, None),
        ('AGENTS.md', 'deps', 'dependencies', 1, 2, None),
        ('docs/agent/recipes.md', 'factoryCtx', 'factoryContext', 2, 0, None),
        ('docs/agent/recipes.md', 'disposerCtx', 'disposerContext', 2, 0, None),
        ('docs/agent/errors.md', 'factoryCtx', 'factoryContext', 9, 0, None),
        ('docs/agent/errors.md', 'disposerCtx', 'disposerContext', 2, 0, None),
        ('docs/agent/errors.md', '_deps', '_dependencies', 2, 0, None),
    ]
    apply = require_uniform([word_state(rule) for rule in rules], 'params')
    if apply:
        for rule in rules:
            apply_word_rule(rule)


def callbacks():
    rules = [
        ('src/registration.ts', 'dispose: (this: void, value: Awaited<ReturnType<NoInfer<F>>>) => void | Promise<void>,', 'dispose: (this: void, acquiredValue: Awaited<ReturnType<NoInfer<F>>>) => void | Promise<void>,', 1),
        ('src/registration.ts', 'dispose: (this: void, value: ProviderAcquiredValue<NoInfer<R>>) => void | Promise<void>,', 'dispose: (this: void, acquiredValue: ProviderAcquiredValue<NoInfer<R>>) => void | Promise<void>,', 1),
        ('src/provider.ts', 'P extends (this: void, value: ProviderOutput<NoInfer<R>>) =>', 'P extends (this: void, exposedService: ProviderOutput<NoInfer<R>>) =>', 3),
        ('src/provider.ts', 'P extends (this: void, value: Awaited<ProviderOutput<NoInfer<R>>>) =>', 'P extends (this: void, fulfilledValue: Awaited<ProviderOutput<NoInfer<R>>>) =>', 3),
        ('src/acquisition-mode.ts', 'readonly isNativePromise: (this: void, value: unknown) => boolean;', 'readonly isNativePromise: (this: void, candidate: unknown) => boolean;', 1),
        ('src/plugins.ts', 'export type PluginOutputValidator<V> = (this: void, value: unknown) => value is V;', 'export type PluginOutputValidator<V> = (this: void, pluginOutput: unknown) => pluginOutput is V;', 1),
        ('src/di-bag.ts', "validate: (value): value is () => string => typeof value === 'function',", "validate: (pluginOutput): pluginOutput is () => string => typeof pluginOutput === 'function',", 1),
        ('src/errors.ts', "validate: (value): value is string => typeof value === 'string' });", "validate: (pluginOutput): pluginOutput is string => typeof pluginOutput === 'string' });", 1),
        ('docs/agent/errors.md', 'runtime: { isNativePromise: value => types.isPromise(value) },', 'runtime: { isNativePromise: candidate => types.isPromise(candidate) },', 1),
        ('docs/agent/errors.md', 'DiBag.fromFunction([port], value => `localhost:${value}`);', 'DiBag.fromFunction([port], portNumber => `localhost:${portNumber}`);', 1),
        ('docs/agent/errors.md', 'DiBag.fromFunction([name], value => `Hello, ${value}`);', 'DiBag.fromFunction([name], personName => `Hello, ${personName}`);', 1),
        ('docs/agent/errors.md', "describe: value => ({ 'app:region': value.region }) },", "describe: exposedClient => ({ 'app:region': exposedClient.region }) },", 1),
        ('docs/agent/errors.md', "validate: (value: unknown): value is Handler => typeof value === 'object' && value !== null && 'handle' in value,", "validate: (pluginOutput: unknown): pluginOutput is Handler => typeof pluginOutput === 'object' && pluginOutput !== null && 'handle' in pluginOutput,", 1),
        ('docs/agent/errors.md', "transform: value => value.toUpperCase() });", "transform: text => text.toUpperCase() });", 1),
    ]
    apply = require_uniform([exact_state(rule) for rule in rules], 'callbacks')
    if apply:
        for rule in rules:
            apply_exact_rule(rule)


def generics():
    documentation_rules = [
        ('src/provider.ts', ' * @typeParam F - The exact', ' * @typeParam ExposedFactory - The exact'),
        ('src/provider.ts', ' * @typeParam M - Static registration', ' * @typeParam RegistrationMetadata - Static registration'),
        ('src/provider.ts', ' * @typeParam A - The ordered tuple', ' * @typeParam AcquisitionMetadataFrames - The ordered tuple'),
        ('src/provider.ts', ' * @typeParam G - The retained token', ' * @typeParam RetainedGraphContract - The retained token'),
        ('src/provider.ts', ' * @typeParam V - The raw or fulfilled', ' * @typeParam AcquiredValue - The raw or fulfilled'),
        ('src/di-bag.ts', ' * @see https://dany-fedorov.github.io/di-bag/agent/api-card.html#bag\n */\nclass Bag<',
         ' * @typeParam ServiceRegistrations - The map from each public service name or token symbol to its registration.\n'
         ' * @typeParam Constraints - The requirements, contributions and lifetime obligations that installed modules retain on this graph.\n'
         ' * @see https://dany-fedorov.github.io/di-bag/agent/api-card.html#bag\n */\nclass Bag<'),
        ('src/di-bag.ts', ' * @see https://dany-fedorov.github.io/di-bag/agent/api-card.html#builder\n */\nclass Builder<',
         ' * @typeParam Entries - The union of accepted registration entries, one per public key.\n'
         ' * @typeParam Constraints - The requirements, contributions and lifetime obligations that installed modules retain on this graph.\n'
         ' * @see https://dany-fedorov.github.io/di-bag/agent/api-card.html#builder\n */\nclass Builder<'),
        ('src/module.ts', ' * type-only class has no public constructor.\n * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#reuse-named-modules\n',
         ' * type-only class has no public constructor.\n'
         ' * @typeParam ExportedServices - The services this module exports, keyed by export name or token symbol.\n'
         ' * @typeParam RequiredServices - The services the installing builder must provide.\n'
         ' * @typeParam Constraints - The checks retained from the sealed graph and applied again at installation.\n'
         ' * @typeParam PublicProviders - The provider contract of each export, as the installing builder sees it.\n'
         ' * @see https://dany-fedorov.github.io/di-bag/guides/tutorial.html#reuse-named-modules\n'),
        ('src/tokens.ts', ' * Create one with `DiBag.token(key).of<Service>()`.\n',
         ' * Create one with `DiBag.token(key).of<Service>()`.\n'
         " * @typeParam TokenSymbol - The unique symbol that is this token's runtime identity.\n"
         ' * @typeParam Service - The service type that bindings must produce and that resolution returns.\n'),
    ]
    class_rules = [
        ('provider.ts', 'class Provider<', {'F': 'ExposedFactory', 'M': 'RegistrationMetadata', 'A': 'AcquisitionMetadataFrames', 'G': 'RetainedGraphContract', 'V': 'AcquiredValue'}, {'F': 4, 'M': 3, 'A': 3, 'G': 3, 'V': 3}),
        ('di-bag.ts', 'class Bag<', {'R': 'ServiceRegistrations', 'C': 'Constraints'}, {'R': 51, 'C': 18}),
        ('di-bag.ts', 'class Builder<', {'E': 'Entries', 'C': 'Constraints'}, {'E': 58, 'C': 31}),
        ('module.ts', 'class Module<', {'P': 'ExportedServices', 'R': 'RequiredServices', 'C': 'Constraints', 'D': 'PublicProviders'}, {'P': 8, 'R': 5, 'C': 5, 'D': 5}),
        ('tokens.ts', 'class Token<', {'K': 'TokenSymbol', 'S': 'Service'}, {'K': 4, 'S': 3}),
    ]
    states = [exact_state((*rule, 1)) for rule in documentation_rules]
    for name, start, names, counts in class_rules:
        path = src / name
        lines = path.read_text().split('\n')
        first = next(i for i, line in enumerate(lines) if line.startswith(start))
        last = next(i for i in range(first, len(lines)) if lines[i] == '}')
        body = '\n'.join(lines[first:last + 1])
        actual_old = {old: len(re.findall(r'\b%s\b' % re.escape(old), body)) for old in names}
        actual_new = {new: len(re.findall(r'\b%s\b' % re.escape(new), body)) for new in names.values()}
        before = actual_old == counts and all(count == 0 for count in actual_new.values())
        after = all(count == 0 for count in actual_old.values()) and actual_new == {
            new: counts[old] for old, new in names.items()
        }
        if not before and not after:
            sys.exit(f'src/{name} {start}: mixed type-parameter state: old={actual_old}, new={actual_new}')
        states.append('before' if before else 'after')
    apply = require_uniform(states, 'generics')
    if apply:
        # Accumulate every edit in one current buffer per file. `di-bag.ts` contains both Bag and
        # Builder, so writing stale per-class snapshots would discard the documentation edits and
        # let the later Builder write overwrite the earlier Bag rename.
        pending = {}
        for name, old, new in documentation_rules:
            path = root / name
            pending[path] = pending.get(path, path.read_text()).replace(old, new)
        for name, start, names, _counts in class_rules:
            path = src / name
            lines = pending.get(path, path.read_text()).split('\n')
            first = next(i for i, line in enumerate(lines) if line.startswith(start))
            last = next(i for i in range(first, len(lines)) if lines[i] == '}')
            body = '\n'.join(lines[first:last + 1])
            for old, new in names.items():
                body = re.sub(r'\b%s\b' % re.escape(old), new, body)
            lines[first:last + 1] = body.split('\n')
            pending[path] = '\n'.join(lines)
        for path, new_text in pending.items():
            rewrite(path, new_text)


{'params': params, 'callbacks': callbacks, 'generics': generics}[step]()
for name in sorted(changed):
    print('changed', name)
print(f'{step}: {len(changed)} files changed')
```

- [ ] **Step 4: Write the test-edit script**

Create `/tmp/di-bag-phase-02/rendering_test_edits.py` with exactly this content:

```python
#!/usr/bin/env python3
"""Extends tools/docs/test/exact-rendering.test.mjs for phase 2.

Usage: python3 rendering_test_edits.py <repo-root> <task1|task2|task3>
Every task accepts only its complete before-state or complete after-state and rejects a mixed state.
"""
import pathlib
import sys

path = pathlib.Path(sys.argv[1]) / 'tools/docs/test/exact-rendering.test.mjs'
task = sys.argv[2]
text = path.read_text()
actions = []


def replace(old, new):
    actions.append(('replace', old, new))


def append(block):
    heading = next((line for line in block.split('\n') if line.startswith("test('")), None)
    if heading is None:
        sys.exit('an appended test block must contain a test heading')
    marker = heading.split("',", 1)[0] + "'"
    actions.append(('append', block, marker))


def action_state(action):
    kind, old, new = action
    if kind == 'append':
        actual = (text.count(old), text.count(new))
        if actual == (0, 0):
            return 'before'
        if actual == (1, 1):
            return 'after'
        sys.exit(f'expected appended block/heading counts (0, 0) before or (1, 1) after, found {actual}')
    actual = (text.count(old), text.count(new))
    before = (1, 0)
    # A replacement can retain its old text as an unchanged suffix inside `new`.
    after = (new.count(old), 1)
    if actual == before:
        return 'before'
    if actual == after:
        return 'after'
    sys.exit(f'expected exact counts {before} before or {after} after, found {actual} for {old!r}')


if task == 'task1':
    replace("let startupError;\n",
            "let startupError;\nlet acquisitionContext;\nlet contextualFactory;\nlet pluginOutputValidator;\nlet provider;\nlet builder;\nlet moduleInterface;\nlet token;\n")
    replace("  startupError = readFileSync(join(output, 'index/classes/DiBagStartupError.md'), 'utf8');\n",
            "  startupError = readFileSync(join(output, 'index/classes/DiBagStartupError.md'), 'utf8');\n"
            "  acquisitionContext = readFileSync(join(output, 'index/interfaces/AcquisitionContext.md'), 'utf8');\n"
            "  contextualFactory = readFileSync(join(output, 'index/type-aliases/ContextualFactory.md'), 'utf8');\n"
            "  pluginOutputValidator = readFileSync(join(output, 'index/type-aliases/PluginOutputValidator.md'), 'utf8');\n"
            "  provider = readFileSync(join(output, 'index/interfaces/Provider.md'), 'utf8');\n"
            "  builder = readFileSync(join(output, 'index/interfaces/Builder.md'), 'utf8');\n"
            "  moduleInterface = readFileSync(join(output, 'index/interfaces/Module.md'), 'utf8');\n"
            "  token = readFileSync(join(output, 'index/interfaces/Token.md'), 'utf8');\n")
    append(r"""
test('documented parameter names carry no abbreviations', () => {
  assert.match(acquisitionContext, /pushDisposer\(this: void, disposer: \(this: void, disposerContext: DisposerContext\) => void \| Promise<void>\): void;/);
  assert.match(compact(contextualFactory), /\(this: void, dependencies: Parameters<F> extends \[\] \? \{\s?\} : Parameters<F>\[0\]\) => ReturnType<F>;/);
  for (const page of [facade, bag, builder, acquisitionContext, contextualFactory]) assert.doesNotMatch(page, /\b(?:factoryCtx|disposerCtx|deps)\b/);
});
""")
elif task == 'task2':
    replace(r"assert.match(runtimeOptions, /readonly isNativePromise: \(this: void, value: unknown\) => boolean;/);",
            r"assert.match(runtimeOptions, /readonly isNativePromise: \(this: void, candidate: unknown\) => boolean;/);")
    append(r"""
test('callback parameters in public signatures are named by role', () => {
  const facadeText = compact(facade);
  assert.match(facadeText, /dispose: \(this: void, acquiredValue: Awaited<ReturnType<NoInfer<F>>>\) => void \| Promise<void>/);
  assert.match(facadeText, /dispose: \(this: void, acquiredValue: ProviderAcquiredValue<NoInfer<R>>\) => void \| Promise<void>/);
  assert.match(facadeText, /P extends \(this: void, exposedService: ProviderOutput<NoInfer<R>>\) =>/);
  assert.match(facadeText, /P extends \(this: void, fulfilledValue: Awaited<ProviderOutput<NoInfer<R>>>\) =>/);
  assert.doesNotMatch(facadeText, /\(this: void, value:/);
  assert.match(pluginOutputValidator, /type PluginOutputValidator<V> = \(this: void, pluginOutput: unknown\) => pluginOutput is V;/);
});
""")
elif task == 'task3':
    replace(r"assert.match(bagText, /inspect<K extends \(keyof R & string\) \| TokenBase>\(token: K & \(\[K\] extends \[string\] \? unknown : TokenMember<R, K>\)\)/);",
            r"assert.match(bagText, /inspect<K extends \(keyof ServiceRegistrations & string\) \| TokenBase>\(token: K & \(\[K\] extends \[string\] \? unknown : TokenMember<ServiceRegistrations, K>\)\)/);")
    append(r"""
test('exported classes name their type parameters by role', () => {
  assert.match(bag, /^# Interface: Bag\\<ServiceRegistrations \*extends\* `Registrations`, Constraints \*extends\* `NeedConstraint` = `never`\\>$/m);
  assert.match(builder, /^# Interface: Builder\\<Entries \*extends\* `Entry`, Constraints \*extends\* `NeedConstraint` = `never`\\>$/m);
  assert.match(moduleInterface, /^# Interface: Module\\<ExportedServices \*extends\* `object`, RequiredServices \*extends\* `object`, Constraints \*extends\* /m);
  assert.match(provider, /^# Interface: Provider\\<ExposedFactory \*extends\* `Factory`, RegistrationMetadata \*extends\* /m);
  assert.match(token, /^# Interface: Token\\<TokenSymbol \*extends\* `symbol`, Service\\>$/m);
  assert.match(bag, /\| `ServiceRegistrations` \| The map from each public service name or token symbol to its registration\. \|/);
  assert.match(builder, /\| `Entries` \| The union of accepted registration entries, one per public key\. \|/);
  assert.match(moduleInterface, /\| `RequiredServices` \| The services the installing builder must provide\. \|/);
  assert.match(token, /\| `TokenSymbol` \| The unique symbol that is this token's runtime identity\. \|/);
});
""")
else:
    sys.exit('task must be task1, task2 or task3')

states = [action_state(action) for action in actions]
if set(states) == {'before'}:
    for kind, old, new in actions:
        if kind == 'replace':
            text = text.replace(old, new)
        else:
            text = text.rstrip('\n') + '\n' + old
    path.write_text(text)
    print(task, 'written')
elif set(states) == {'after'}:
    print(task, 'already applied')
else:
    sys.exit(f'{task}: mixed or partially applied state: {states}')
```

- [ ] **Step 5: Check that both scripts parse**

Run: `python3 -m py_compile /tmp/di-bag-phase-02/phase2_renames.py /tmp/di-bag-phase-02/rendering_test_edits.py && echo ok`
Expected: `ok`

Nothing is committed in this task. The scripts are one-off tools and stay outside the repository.

---

### Task 1: Spell out `factoryContext`, `disposerContext` and `dependencies`

**Files:**
- Create: `tests/documented-names.test.ts`
- Modify: `tools/docs/test/exact-rendering.test.mjs` (through the script)
- Modify: `tests/types/negative/startup.ts:53`, `tests/types/startup.ts:45`
- Modify: every `src/*.ts` that contains one of the three names, `AGENTS.md`, `docs/agent/recipes.md`, `docs/agent/errors.md` (through the script)
- Regenerate: `docs/agent/api-card.md`, `docs/reference/**`

**Interfaces:**
- Consumes: the two scripts of task 0.
- Produces: in `src/acquisition-context.ts`, `pushDisposer(this: void, disposer: (this: void, disposerContext: DisposerContext) => void | Promise<void>): void` and `type ContextFactory = (this: void, dependencies: never, factoryContext: AcquisitionContext) => unknown`; in `src/registration.ts`, `export type Factory = (this: void, dependencies: never) => unknown`. The test `tests/documented-names.test.ts` keeps these names from coming back.

- [ ] **Step 1: Write the failing source scan**

Create `tests/documented-names.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The naming standard (docs/guides/api-naming.md, rule 7) bans abbreviations in names a reader
// sees: signatures, JSDoc and the agent docs. Test files and examples name their own parameters.
const root = resolve(__dirname, '..');
const abbreviation = /\b(factoryCtx|disposerCtx|deps|_deps)\b/;

// The dependency proxy's `in` trap quotes the caller's expression in a runtime message and in
// `details.access`. Message text is behavior; the error phase of the 0.5.0 program rewrites it.
const allowed = new Set(["src/acquisition.ts: has: (_, key) => { throw invalidAccess(`'${String(key)}' in deps`); },"]);

function offenders(files: readonly string[]): string[] {
  return files.flatMap(file => readFileSync(join(root, file), 'utf8').split('\n').flatMap((line, index) =>
    abbreviation.test(line) && !allowed.has(`${file}: ${line.trim()}`) ? [`${file}:${index + 1}: ${line.trim()}`] : []));
}

test('library source spells out factoryContext, disposerContext and dependencies', () => {
  const files = readdirSync(join(root, 'src')).filter(name => name.endsWith('.ts')).sort().map(name => `src/${name}`);
  expect(offenders(files)).toEqual([]);
});

test('agent docs spell out factoryContext, disposerContext and dependencies', () => {
  const agentDocs = readdirSync(join(root, 'docs/agent')).filter(name => name.endsWith('.md')).sort().map(name => `docs/agent/${name}`);
  expect(offenders(['AGENTS.md', ...agentDocs])).toEqual([]);
});
```

A new `tests/*.test.ts` file joins the fast lane by itself; `scripts/test-lane.mjs` lists only the compiler lane.

- [ ] **Step 2: Run it to make sure it fails**

Run: `bun test tests/documented-names.test.ts`
Expected: `0 pass`, `2 fail`. The first failure lists lines such as `src/acquisition-context.ts:39: pushDisposer(this: void, disposer: (this: void, disposerCtx: DisposerContext) => …`. The second lists lines from `AGENTS.md`, `docs/agent/recipes.md` and `docs/agent/errors.md`.

- [ ] **Step 3: Pin the rendered signatures**

Run: `python3 /tmp/di-bag-phase-02/rendering_test_edits.py "$PWD" task1`
Expected: `task1 written`

It adds seven page variables and their `readFileSync` loads to the setup of `tools/docs/test/exact-rendering.test.mjs`, and appends the test `documented parameter names carry no abbreviations`.

Run: `node --test tools/docs/test/exact-rendering.test.mjs 2>&1 | grep -E '^✖|^ℹ (pass|fail)' | sort -u`
Expected:

```text
ℹ fail 1
ℹ pass 4
✖ documented parameter names carry no abbreviations
✖ failing tests:
```

(The `✖` lines end with a duration in brackets.)

- [ ] **Step 4: Update the one expected diagnostic that quotes a library parameter name**

```bash
sed -i "s/parameter of type '(this: void, disposerCtx: DisposerContext) => void | Promise<void>'/parameter of type '(this: void, disposerContext: DisposerContext) => void | Promise<void>'/" tests/types/negative/startup.ts
sed -i 's/\[disposer: (this: void, disposerCtx: DisposerContext) => void | Promise<void>\]/[disposer: (this: void, disposerContext: DisposerContext) => void | Promise<void>]/' tests/types/startup.ts
git diff --stat tests/types    # expected: 2 files changed, 2 insertions(+), 2 deletions(-)
grep -n "disposerContext" tests/types/negative/startup.ts tests/types/startup.ts
```

Expected from the last command: `tests/types/negative/startup.ts:53:` with the `// diagnostic:` comment, and `tests/types/startup.ts:45:`. The other `factoryCtx`, `_deps`, `_disposerCtx` and `disposerCtx` in those fixtures are the fixture's own parameter names and stay.

`tests/types.test.ts` compiles every negative fixture in one program and takes a few minutes. Run it once now to see the red state:

Run: `bun test tests/types.test.ts -t "type rejection: startup.ts"`
Expected: FAIL for `type rejection: startup.ts`, because the compiler still prints `disposerCtx`.

- [ ] **Step 5: Apply the renames**

Run: `python3 /tmp/di-bag-phase-02/phase2_renames.py "$PWD" params`
Expected: thirteen `changed …` lines and `params: 13 files changed`. The files are `AGENTS.md`, `docs/agent/errors.md`, `docs/agent/recipes.md`, and under `src/`: `acquisition-context.ts`, `acquisition.ts`, `alias-types.ts`, `composition.ts`, `di-bag.ts`, `plugins.ts`, `provider-execution.ts`, `provider.ts`, `registration.ts`, `types.ts`.

Check what is left:

```bash
grep -rnE '\b(factoryCtx|disposerCtx|deps|_deps)\b' src AGENTS.md docs/agent
wc -l AGENTS.md
```

Expected: exactly one matching line, the runtime message that stays, and then the line count:

```text
src/acquisition.ts:299:      has: (_, key) => { throw invalidAccess(`'${String(key)}' in deps`); },
150 AGENTS.md
```

- [ ] **Step 6: Run the tests to make sure they pass**

```bash
bun test tests/documented-names.test.ts                     # expected: 2 pass, 0 fail
npm run typecheck                                            # expected: exits 0, no error lines
bun test tests/dependency-proxy.test.ts tests/acquisition.test.ts tests/acquisition-cleanup.test.ts tests/plugins.test.ts tests/composition-adapters.test.ts   # expected: 0 fail
node --test tools/docs/test/exact-rendering.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)'   # expected: ℹ pass 5, ℹ fail 0
bun test tests/types.test.ts -t "type rejection: startup.ts"  # expected: pass
```

`tests/dependency-proxy.test.ts` proves that the runtime message `'logger' in deps` did not change.

- [ ] **Step 7: Regenerate the API card and the reference**

```bash
npm run build
npm run docs:generate
git status --short docs
node tools/docs/check-agent-docs.mjs
```

Expected: `docs:generate` ends with `Generated 112 API Markdown pages with verified public coverage and 273 valid TypeScript blocks.` The changed generated files are `docs/reference/index/interfaces/AcquisitionContext.md`, `docs/reference/index/interfaces/DiBagApi.md`, `docs/reference/index/interfaces/Builder.md`, `docs/reference/index/type-aliases/AliasRegistration.md`, `docs/reference/index/type-aliases/ContextualFactory.md` and `docs/reference/index/type-aliases/OverrideFactoryContext.md`. `docs/agent/api-card.md` and `docs/reference/api-coverage.json` do not change in this task. `check-agent-docs.mjs` prints `Agent docs are consistent: 112 snippets type-check against the emitted declarations.`

- [ ] **Step 8: Commit**

```bash
git add tests/documented-names.test.ts tests/types/negative/startup.ts tests/types/startup.ts tools/docs/test/exact-rendering.test.mjs src AGENTS.md docs/agent docs/reference
git commit -q -F - <<'MSG'
refactor(names): spell out factoryContext, disposerContext and dependencies

Signatures, JSDoc and the agent docs no longer abbreviate parameter names.
Runtime locals that hold the dependency proxy are called dependencyProxy. The
runtime message "'<key>' in deps" is behavior and keeps its text.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
git log --oneline -1
```

---

### Task 2: Name callback parameters by role

**Files:**
- Modify: `tools/docs/test/exact-rendering.test.mjs` (through the script)
- Modify: `src/registration.ts`, `src/provider.ts`, `src/acquisition-mode.ts`, `src/plugins.ts`, `src/di-bag.ts`, `src/errors.ts`, `docs/agent/errors.md` (through the script)
- Regenerate: `docs/agent/api-card.md`, `docs/reference/**`

**Interfaces:**
- Consumes: task 1's version of the rendering test.
- Produces: `withDisposal(create, dispose: (this: void, acquiredValue: …) => void | Promise<void>)`, `transformService` and `withMetadata` callbacks `(this: void, exposedService: ProviderOutput<…>)` and `(this: void, fulfilledValue: Awaited<ProviderOutput<…>>)`, `RuntimeOptions.isNativePromise: (this: void, candidate: unknown) => boolean`, `PluginOutputValidator<V> = (this: void, pluginOutput: unknown) => pluginOutput is V`.

- [ ] **Step 1: Write the failing assertions**

Run: `python3 /tmp/di-bag-phase-02/rendering_test_edits.py "$PWD" task2`
Expected: `task2 written`

It changes the pinned `isNativePromise` signature from `value: unknown` to `candidate: unknown` and appends the test `callback parameters in public signatures are named by role`.

- [ ] **Step 2: Run the test to make sure it fails**

Run: `node --test tools/docs/test/exact-rendering.test.mjs 2>&1 | grep -E '^✖|^ℹ (pass|fail)' | sort -u`
Expected:

```text
ℹ fail 2
ℹ pass 4
✖ callback parameters in public signatures are named by role
✖ failing tests:
✖ source declarations preserve aliases and property modifiers exactly
```

- [ ] **Step 3: Apply the renames**

Run: `python3 /tmp/di-bag-phase-02/phase2_renames.py "$PWD" callbacks`
Expected: `callbacks: 7 files changed`, naming `docs/agent/errors.md`, `src/acquisition-mode.ts`, `src/di-bag.ts`, `src/errors.ts`, `src/plugins.ts`, `src/provider.ts`, `src/registration.ts`.

The script validates every exact string before writing any file. If it reports a mixed or unexpected state, inspect the named text and either restore the whole task to its complete before-state and rerun, or apply every rename in this table by hand and verify the complete after-state. Do not repair one entry and rerun against a mixed task.

| File | Parameter | New name |
| --- | --- | --- |
| `src/registration.ts` | `dispose: (this: void, value: …)`, both public overloads | `acquiredValue` |
| `src/provider.ts` | `P extends (this: void, value: ProviderOutput<NoInfer<R>>) =>`, three times | `exposedService` |
| `src/provider.ts` | `P extends (this: void, value: Awaited<ProviderOutput<NoInfer<R>>>) =>`, three times | `fulfilledValue` |
| `src/acquisition-mode.ts` | `isNativePromise: (this: void, value: unknown)` | `candidate` |
| `src/plugins.ts` | `PluginOutputValidator<V> = (this: void, value: unknown) => value is V` | `pluginOutput` |
| `src/di-bag.ts`, `src/errors.ts` | the `validate: (value): value is …` in two `@example` blocks | `pluginOutput` |
| `docs/agent/errors.md` | six snippet callbacks called `value` | `candidate`, `portNumber`, `personName`, `exposedClient`, `pluginOutput`, `text` |

The implementation-only `dispose: (value: never) => …` signature in `withDisposal` stays unchanged, as required by "What this phase does not touch".

- [ ] **Step 4: Run the tests to make sure they pass**

```bash
npm run typecheck                                            # expected: exits 0
node --test tools/docs/test/exact-rendering.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)'   # expected: ℹ pass 6, ℹ fail 0
bun test tests/plugins.test.ts tests/projections.test.ts tests/acquisition-metadata.test.ts tests/disposal.test.ts tests/acquisition-mode.test.ts   # expected: 0 fail
```

- [ ] **Step 5: Regenerate and check the agent docs**

```bash
npm run build
npm run docs:generate
node tools/docs/check-agent-docs.mjs
git diff --stat docs/agent/api-card.md
```

Expected: `check-agent-docs.mjs` prints `Agent docs are consistent: 112 snippets type-check against the emitted declarations.` `docs/agent/api-card.md` changes in two lines: the `validate:` callbacks of the `DiBag.fromPlugin` example and of the `DiBagPluginValidationError` example now say `pluginOutput`. Generated reference files that change: `docs/reference/index/interfaces/DiBagApi.md`, `docs/reference/index/interfaces/RuntimeOptions.md`, `docs/reference/index/type-aliases/PluginOutputValidator.md`, `docs/reference/index/classes/DiBagPluginValidationError.md`.

- [ ] **Step 6: Commit**

```bash
git add tools/docs/test/exact-rendering.test.mjs src docs/agent docs/reference
git commit -q -F - <<'MSG'
refactor(names): name callback parameters by role

Disposers receive acquiredValue, transform and describe callbacks receive
exposedService or fulfilledValue, the Promise classifier receives candidate,
and a plugin validator receives pluginOutput. A type predicate compares
parameters by position, so existing callers still type-check.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
git log --oneline -1
```

---

### Task 3: Role names for the type parameters of the five exported classes

**Files:**
- Modify: `tools/docs/test/exact-rendering.test.mjs` (through the script)
- Modify: `src/provider.ts`, `src/di-bag.ts`, `src/module.ts`, `src/tokens.ts` (through the script)
- Assert only: `docs/superpowers/specs/2026-09-20-swift-api-style.md` (controller-owned entry condition; never edit or stage)
- Regenerate: `docs/reference/**`

**Interfaces:**
- Consumes: task 2's version of the rendering test.
- Produces: `class Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue>`, `class Bag<ServiceRegistrations, Constraints>`, `class Builder<Entries, Constraints>`, `class Module<ExportedServices, RequiredServices, Constraints, PublicProviders>`, `class Token<TokenSymbol, Service>`. Later phases that add a method inside `Bag` or `Builder` must write `ServiceRegistrations`, `Entries` and `Constraints`, not `R`, `E` and `C`.

- [ ] **Step 1: Write the failing assertions**

Run: `python3 /tmp/di-bag-phase-02/rendering_test_edits.py "$PWD" task3`
Expected: `task3 written`

It changes the pinned `inspect` signature from `keyof R` and `TokenMember<R, K>` to `keyof ServiceRegistrations` and `TokenMember<ServiceRegistrations, K>`, and appends the test `exported classes name their type parameters by role`, which checks the five page headings and the description rows of the new `@typeParam` tags.

- [ ] **Step 2: Run the test to make sure it fails**

Run: `node --test tools/docs/test/exact-rendering.test.mjs 2>&1 | grep -E '^✖|^ℹ (pass|fail)' | sort -u`
Expected:

```text
ℹ fail 2
ℹ pass 5
✖ compiler declarations retain syntax that TypeDoc reflections cannot represent
✖ exported classes name their type parameters by role
✖ failing tests:
```

- [ ] **Step 3: Apply the renames**

Run: `python3 /tmp/di-bag-phase-02/phase2_renames.py "$PWD" generics`
Expected: `generics: 4 files changed`, naming `src/di-bag.ts`, `src/module.ts`, `src/provider.ts`, `src/tokens.ts`.

What the script does after it has verified that every documentation and class-body edit is in the complete before-state:

1. It renames the five `@typeParam` tags above `class Provider` and adds `@typeParam` tags to the JSDoc of `Bag`, `Builder`, `Module` and `Token`, each just above the class's `@see` line.
2. For each class it takes the lines from `class Name<` to the first line that is exactly `}`, counts the standalone letters, and stops if a count differs: `Provider` F 4, M 3, A 3, G 3, V 3; `Bag` R 51, C 18; `Builder` E 58, C 31; `Module` P 8, R 5, C 5, D 5; `Token` K 4, S 3. Then it replaces each letter, as a whole word, inside that range only.

Check the result:

```bash
grep -n "^class Provider<\|^class Bag<\|^class Builder<\|^class Module<\|^class Token<" src/*.ts | cut -c1-140
grep -n "installModule<P extends object, R extends object" src/di-bag.ts     # expected: one line; this method keeps its own R
```

Expected first lines: `src/di-bag.ts:…:class Bag<ServiceRegistrations extends Registrations, Constraints extends NeedConstraint = never> {`, `src/di-bag.ts:…:class Builder<Entries extends Entry, Constraints extends NeedConstraint = never> {`, `src/module.ts:…:class Module<ExportedServices extends object, RequiredServices extends object, …`, `src/provider.ts:…:class Provider<ExposedFactory extends Factory, RegistrationMetadata extends object = …`, `src/tokens.ts:…:class Token<TokenSymbol extends symbol, Service> extends TokenBase {`.

- [ ] **Step 4: Run the tests to make sure they pass**

```bash
npm run typecheck                                            # expected: exits 0
node --test tools/docs/test/exact-rendering.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)'   # expected: ℹ pass 7, ℹ fail 0
npm run test:fast 2>&1 | tail -5                             # expected: 0 fail
```

- [ ] **Step 5: Assert the controller-owned spec correction**

The controller lands this exact paragraph in the spec before phase 2 starts:

```text
Generic parameters get role names: `Provider<ExposedFactory, RegistrationMetadata,
AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue>`,
`Container<ServiceRegistrations, Constraints>`, `Builder<Entries, Constraints>`,
`Module<ExportedServices, RequiredServices, Constraints, PublicProviders>`,
`Token<TokenSymbol, Service>`. `Factory`, `GraphContract` and `Registrations` are
imported types in the same files, so a type parameter of the same name would
shadow them and make its own constraint circular; those three take another role
name. This does not break callers.
```

Assert it without changing the file:

```bash
sed -n '/Generic parameters get role names:/,/name\. This does not break callers\./p' docs/superpowers/specs/2026-09-20-swift-api-style.md
git diff --exit-code -- docs/superpowers/specs/2026-09-20-swift-api-style.md
```

Expected: the first command prints exactly the paragraph above and `git diff` exits 0 with no output. If either check fails, stop and report the missing controller prerequisite; the phase executor never repairs, edits or stages the spec.

- [ ] **Step 6: Regenerate**

```bash
npm run build
npm run docs:generate
git status --short docs/reference | wc -l
npm run docs:check 2>&1 | tail -3
```

Expected: `10`. The class pages `Bag.md`, `Builder.md`, `Module.md`, `Provider.md` and `Token.md` under `docs/reference/index/interfaces/` change their headings, signatures and type parameter tables. Five more pages change only in their `Defined in:` line numbers, because the added `@typeParam` lines move the declarations below them: `interfaces/ConfigurationOptions.md`, `interfaces/DiBagApi.md`, `type-aliases/TokenKey.md`, `type-aliases/TokenService.md` and `variables/DiBag.md`. `docs:check` ends with `Prepared 129 Markdown pages; repository-only links point to GitHub.` The page count is higher if phase 0 added guide pages; any count is fine as long as the command exits 0.

- [ ] **Step 7: Commit**

```bash
git add tools/docs/test/exact-rendering.test.mjs src docs/reference
git commit -q -F - <<'MSG'
refactor(names): role names for the type parameters of the exported classes

Provider, Bag, Builder, Module and Token name their type parameters by role and
document each one. Factory, GraphContract and Registrations are imported types
in the same files, so those three parameters are ExposedFactory,
RetainedGraphContract and ServiceRegistrations.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
git log --oneline -1
```

---

### Task 4: Guard the API card summaries, and reword `bag.resolve`

**Files:**
- Create: `tools/docs/test/api-card-summaries.test.mjs`
- Create: `tools/docs/api-card-summary-exceptions.json`
- Modify: `src/di-bag.ts` (one JSDoc line)
- Regenerate: `docs/agent/api-card.md`, `docs/reference/index/interfaces/Bag.md`

**Interfaces:**
- Consumes: task 3's `src/di-bag.ts`, regenerated `docs/agent/api-card.md` and regenerated `docs/reference/index/interfaces/Bag.md`. Each card call is a `### … {#id}` heading followed by one line: the summary, then optionally ` Throws: …`.
- Produces: a staged "or" ratchet and an explicit accepted-leading-verb check that later phases meet. When a phase renames or removes a call whose id is in `tools/docs/api-card-summary-exceptions.json`, the test fails with "an exception is stale" and that phase deletes the id. The four controller-authorized ids are `builder-alias` (phase 5), `dibag-fromfactory` (phase 8), `dibag-withlifetime` and `dibag-withmetadata` (phase 9); final acceptance requires none.

- [ ] **Step 1: Write the failing test**

Create `tools/docs/test/api-card-summaries.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// The naming standard (docs/guides/api-naming.md, rule 13): a call whose summary needs "or"
// between two purposes should be two calls. Each current summary starts with a reviewed imperative verb.
// This reads the generated card, so run `npm run docs:generate` after editing a JSDoc summary.
const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const card = readFileSync(resolve(directory, '../../docs/agent/api-card.md'), 'utf8');
const exceptions = JSON.parse(readFileSync(resolve(directory, 'api-card-summary-exceptions.json'), 'utf8'));

/** The summary of every call in the card, keyed by its heading id. Error classes are nouns and are skipped. */
function callSummaries(markdown) {
  const lines = markdown.split('\n');
  const summaries = [];
  let section = '';
  lines.forEach((line, index) => {
    const sectionHeading = /^## .*\{#([a-z0-9-]+)\}$/.exec(line);
    if (sectionHeading) { section = sectionHeading[1]; return; }
    const heading = /^### .*\{#([a-z0-9-]+)\}$/.exec(line);
    if (!heading || section === 'errors' || section === 'one-way-per-task') return;
    summaries.push({ id: heading[1], text: (lines[index + 1] ?? '').replace(/ Throws: .*$/, '') });
  });
  return summaries;
}

const summaries = callSummaries(card);
const acceptedLeadingVerbs = new Set([
  'Adapt', 'Add', 'Append', 'Attach', 'Begin', 'Close', 'Create', 'Describe', 'Finish', 'Inspect',
  'Install', 'Make', 'Replace', 'Report', 'Resolve', 'Return', 'Seal', 'Select', 'Transform', 'Validate',
]);
const leadingWord = text => /^([A-Z][a-z]+)\b/.exec(text)?.[1];

test('the card has call summaries to check', () => {
  assert(summaries.length >= 20, `found ${summaries.length} call summaries`);
  for (const { id, text } of summaries) assert(text.length > 0, `${id} has no summary line`);
});

test('no call summary needs "or", apart from the recorded exceptions', () => {
  const offenders = summaries.filter(({ text }) => /\bor\b/.test(text)).map(({ id }) => id).sort();
  assert.deepEqual(offenders, [...exceptions.or].sort(),
    'A new id means a summary joins two purposes with "or": split the call or reword the summary. '
    + 'A missing id means an exception is stale: delete it from tools/docs/api-card-summary-exceptions.json.');
});

test('the accepted leading-word set rejects a noun-phrase control', () => {
  assert.equal(acceptedLeadingVerbs.has(leadingWord('Services remain cached.')), false);
});

test('every call summary starts with a reviewed imperative verb', () => {
  const offenders = summaries.filter(({ text }) => !acceptedLeadingVerbs.has(leadingWord(text))).map(({ id }) => id).sort();
  assert.deepEqual(offenders, [],
    'A summary must start with a reviewed imperative verb. Add a genuinely new verb to acceptedLeadingVerbs only with its intentional summary.');
});
```

Create `tools/docs/api-card-summary-exceptions.json`:

```json
{
  "or": ["builder-alias", "dibag-fromfactory", "dibag-withlifetime", "dibag-withmetadata"]
}
```

`npm run docs:check` runs `node --test --test-isolation=none tools/docs/test/*.test.mjs`, so the new file needs no registration.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test tools/docs/test/api-card-summaries.test.mjs 2>&1 | grep -E "^✖|^ℹ (pass|fail)|bag-resolve" | sort -u`
Expected: `ℹ fail 1`, `ℹ pass 3`, the failing test `no call summary needs "or", apart from the recorded exceptions`, and a line showing `'bag-resolve'` in the actual list. The noun-phrase control passes because `Services` is not an accepted imperative verb.

- [ ] **Step 3: Reword the summary**

In `src/di-bag.ts`, in the JSDoc above `resolve<K extends …>` inside `class Bag`, replace the first line:

```text
   * Resolve a named or typed-token service, acquiring it lazily when needed.
```

with:

```text
   * Resolve a registered service, acquiring it lazily when needed.
```

Run: `grep -c "Resolve a registered service, acquiring it lazily when needed." src/di-bag.ts`
Expected: `1`

The `@param token` line below it already says that the key is a public string name or a typed token. The summaries of `DiBag.fromFactory`, `DiBag.withLifetime`, `DiBag.withMetadata` and `builder.alias` stay; the phases named above rewrite them together with the calls.

- [ ] **Step 4: Regenerate and run the test to make sure it passes**

```bash
npm run docs:generate
node --test tools/docs/test/api-card-summaries.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)'   # expected: ℹ pass 4, ℹ fail 0
git status --short docs
```

Expected changed files: `docs/agent/api-card.md` (the `bag.resolve` summary line) and `docs/reference/index/interfaces/Bag.md`.

- [ ] **Step 5: Commit**

```bash
git add tools/docs/test/api-card-summaries.test.mjs tools/docs/api-card-summary-exceptions.json src/di-bag.ts docs/agent/api-card.md docs/reference
git commit -q -F - <<'MSG'
test(docs): guard API card summaries with the "or" test and the verb test

A call summary that needs "or" marks a call to split, and each call summary
starts with a reviewed imperative verb. Four summaries are recorded as staged
exceptions until their named phases rewrite those calls. bag.resolve loses its
"or" now.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
git log --oneline -1
```

---

### Task 5: Ratchet, evidence, gates and report

**Files:**
- Modify: `tests/api-naming-known-violations.json` (entries removed only)
- Create: `docs/superpowers/plans/evidence/phase-02.md`

**Interfaces:**
- Consumes: the completed source, tests and generated docs from tasks 1 to 4; the naming test of phase 0; `docs/superpowers/plans/evidence/baseline.md`; and every gate present after phase 1.
- Produces: the evidence file, which also lists the names later phases meet.

- [ ] **Step 1: Shrink the known-violations list**

```bash
set -o pipefail
npm run build
ls tests/api-naming*.test.ts
sed -n 1,30p tests/api-naming*.test.ts
bun test tests/api-naming*.test.ts 2>&1 | tail -30
```

The first lines of the naming test say how to update the list when it has an update command. A ratchet test fails when a recorded violation no longer occurs and names it. Remove exactly the entries it names, by its update command or by deleting those entries from `tests/api-naming-known-violations.json`, then run it again until it passes.

Expected: exactly three removed entries, `abbreviation: parameter factoryCtx`, `abbreviation: parameter disposerCtx` and `abbreviation: parameter deps`. Phase 0 recorded no callback-`value` or one-letter-generic entries. Prove that nothing was added:

```bash
git diff tests/api-naming-known-violations.json | grep '^+' | grep -v '^+++'    # expected: no output
```

If the test does not name exactly those three stale entries, stop and report an entry-state mismatch before updating the file.

- [ ] **Step 2: Measure the twelve benchmark cases**

```bash
node scripts/evidence-cases.mjs --compare docs/superpowers/plans/evidence/baseline.md
```

This phase-0 helper is authoritative. It runs all twelve cases in fresh processes, checks that each case is accepted, compares every instantiation count with the baseline and exits nonzero over the +10% budget. Expected: a twelve-row Markdown table, every `Accepted` cell is `yes`, every `Change` is `0.0%`, and exit 0. Renaming should change no type; if any count differs at all, stop, find it with `git diff next -- src`, and report even when the difference remains under budget. Use this table for step 3.

- [ ] **Step 3: Write the evidence file**

Create `docs/superpowers/plans/evidence/phase-02.md` with this structure, filling the table from step 2 and the baseline:

```markdown
# Phase 2 evidence: non-breaking names

Measured on branch `phase-02-non-breaking-names` after the last task.

| Case | Baseline | Now | Change |
| --- | --- | --- | --- |
| bulk 100 | … | … | 0.0% |

(twelve rows: bulk, chained, grouped, replacement, bindings, modules at 100 and 500)

No spike belongs to this phase.

## Names later phases meet

| Before phase 2 | After phase 2 |
| --- | --- |
| `factoryCtx`, `disposerCtx` | `factoryContext`, `disposerContext` |
| `deps` in signatures and JSDoc | `dependencies` |
| `deps` as the runtime proxy local | `dependencyProxy` |
| `Bag<R, C>` | `Bag<ServiceRegistrations, Constraints>` |
| `Builder<E, C>` | `Builder<Entries, Constraints>` |
| `Module<P, R, C, D>` | `Module<ExportedServices, RequiredServices, Constraints, PublicProviders>` |
| `Provider<F, M, A, G, V>` | `Provider<ExposedFactory, RegistrationMetadata, AcquisitionMetadataFrames, RetainedGraphContract, AcquiredValue>` |
| `Token<K, S>` | `Token<TokenSymbol, Service>` |

A plan that adds or edits a method inside `class Bag` or `class Builder` writes
`ServiceRegistrations`, `Entries` and `Constraints` where older text says `R`, `E`
and `C`. Type parameters of methods and helper types kept their letters.

## Left for later phases

- The runtime message `'<key>' in deps` in `src/acquisition.ts` (phase 11).
- `factoryCtx` in `examples/react/project-runtime.ts` and in `docs/guides/react-integration.md`, which quotes it (phases 8 and 12).
- The four ids in `tools/docs/api-card-summary-exceptions.json` (phases 5, 8 and 9).
```

Replace each `…` with the measured number. A row reads, for example, `| bindings 100 | 847,247 | 847,247 | 0.0% |`.

- [ ] **Step 4: Run the full gate list**

```bash
set -o pipefail
npm run check 2>&1 | tail -15
npm run docs:check 2>&1 | tail -3
npm run graph:check 2>&1 | tail -5
npm run codemod:check 2>&1 | tail -5
node --expose-gc --test --test-isolation=none tests/runtime-scale.node.mjs tests/acquisition-retention.node.mjs tests/graph-retention.node.mjs 2>&1 | tail -8
npm run agent-eval:test 2>&1 | tail -5
npm run typecheck:native 2>&1 | tail -3
npm run build:native 2>&1 | tail -3
npm run check:native 2>&1 | tail -5
for example in examples/*.ts; do bun run "$example" > /dev/null || { echo "FAILED $example"; exit 1; }; done
npm run build 2>&1 | tail -1
```

Expected: every command exits 0, the test lanes report `0 fail`, the three retention suites pass, and the examples loop prints nothing. `set -o pipefail` makes a failed command visible through each reporting pipe, and the examples loop exits on its first failure. `npm run check` builds classic `dist/` before the retention suites read it. The last `npm run build` restores classic `dist/` after the native build. Keep the last lines of each command for the report.

- [ ] **Step 5: Commit**

```bash
git add tests/api-naming-known-violations.json docs/superpowers/plans/evidence/phase-02.md
git commit -q -F - <<'MSG'
docs(plans): phase 2 evidence and a shorter known-violations list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01URAuHKzgTPsPixaqiUvysL
MSG
git log --oneline next..HEAD
```

If `tests/api-naming-known-violations.json` did not change, `git add` of it is harmless.

- [ ] **Step 6: Report to the controller**

Reply in at most 60 lines with: the branch name `phase-02-non-breaking-names`; the output of `git log --oneline next..HEAD`; the last lines of each gate command; the twelve measurements with their change; how many known-violation entries were removed; anything a script refused to do and whether the task was restored before rerunning or completed entirely by hand; and any deviation from this plan with its reason. Do not push.

---

## Self-Review

**Spec coverage.** Roadmap phase 2 asks for documented parameter names (task 1), callback parameter names (task 2), generic parameter names (task 3), and summaries guarded by the "or" test (task 4). Standard rule 5 covers tasks 1 to 3, rule 7 covers task 1, rule 13 covers task 4. The master plan's gate list, evidence rule and report format are task 5. The controller-authorized staged ratchet records exactly four existing summary exceptions; phases 5, 8 and 9 remove their named ids, and final acceptance still requires the empty list.

**Verified, not assumed.** The original edit scripts, both new test files and the three red-green cycles of the rendering test were rehearsed on a scratch copy of the 0.4.0 source on 2026-09-21: every original step applied, `tsc6` reported no error after each step, TypeDoc accepted the new `@typeParam` tags with warnings treated as errors, `docs:generate` produced the same file set with an unchanged `api-coverage.json`, and the failing tests before each step were exactly those listed. The revised scripts' scoped before/after counts were checked mechanically against the current source, including pre-existing `dependencies` identifiers and the method-local `R` that is outside Builder's rename map, but the revised scripts were not executed during this plan repair. Task 0's parse check and each task's first red-green run are their execution verification. `tests/types.test.ts`, the native checks and the benchmark cases were not run while writing this plan.

**Placeholder scan.** The only `…` to fill are the measured numbers of the evidence table, which do not exist before the phase runs.

**Type consistency.** `factoryContext`, `disposerContext`, `dependencies`, `dependencyProxy`, `acquiredValue`, `exposedService`, `fulfilledValue`, `candidate`, `pluginOutput` and the fourteen type parameter names are spelled the same in the decisions tables, both scripts, the test assertions, the spec paragraph and the evidence file.
