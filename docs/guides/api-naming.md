# API naming standard

[Documentation map](../README.md) · [Documentation maintenance](documentation.md) · [Glossary](../../CONTEXT.md)

This guide is for contributors. Every public name of DI Bag follows it: methods,
options, string values, error codes, exported types, and the parameter names that
show up in editor hints. The library is written mostly by and for coding agents,
and an agent reads names before it reads a guide, so the names are the primary
documentation.

The standard is the
[Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/),
translated to TypeScript. The
[W3C Web Platform Design Principles](https://www.w3.org/TR/design-principles/)
are the secondary source for option dictionaries and string values. The decision
and the complete 0.4.0 to 0.5.0 rename map are recorded in the
[Swift API style design note](../superpowers/specs/2026-09-20-swift-api-style.md).

## From Swift to TypeScript

Swift has argument labels and TypeScript does not, so the rules are translated:

| Swift | TypeScript in DI Bag |
| --- | --- |
| Argument label | Property name in an options bag |
| Omitted first label, because the argument reads as a phrase with the method name | Positional first parameter |
| Defaulted parameter | Optional property of the options bag |
| Non-mutating counterpart of a verb, `sorted` for `sort` | `with…` prefix, as in `Array.prototype.with` and this library's own facade |
| Factory method prefix `make` | `create`, because JavaScript precedent is `createElement` and "Embrace precedent" decides it |

## The rules

Quotations are from the Swift guidelines unless a rule names the W3C principles.

1. **Clarity at the point of use.** "Clarity at the point of use is your most
   important goal", and "Clarity is more important than brevity." Long names are
   fine. "Include all the words needed to avoid ambiguity":
   `verifyGraphAtCompileTime`, never `verifyGraph`, because the call does nothing
   when it runs.
2. **Every word carries information.** "Omit needless words. Every word in a name
   should convey salient information at the use site." `resolve` stays `resolve`,
   because adding "Service" says nothing new at the call site.
3. **Effects decide the part of speech.** "Those with side-effects should read as
   imperative verb phrases": `ensureServicesReady`, `close`. "Those without
   side-effects should read as noun phrases": `graphSnapshot()`. A method that
   returns a modified copy is named `with…`: `withServices`. Every builder method
   returns a new builder, so every builder method that adds to the graph is a
   `with…` method.
4. **Parameter shape follows the count of required inputs.** W3C:
   ["Accept optional and/or primitive arguments through dictionaries"](https://www.w3.org/TR/design-principles/#prefer-dictionaries)
   and ["Make method arguments optional if possible"](https://www.w3.org/TR/design-principles/#optional-parameters).
   Swift: omit the first label when the argument "forms part of a grammatical
   phrase", and "Label all other arguments."
   - None required: one optional options bag.
   - Exactly one required, and it reads as a phrase with the method name: that
     input positional, then a bag in which every property is optional.
     `ensureServicesReady(serviceKeys, options?)`.
   - Two or more required: one bag with named properties.
     `withServiceAlias({ aliasKey, targetServiceKey })`.
   - A builder method with two or more inputs takes one bag with named
     properties. `withInstalledModules(modules)` keeps its single positional
     input: the list reads as a phrase with the method name, and a bag that only
     wraps one value adds nothing. An optional bag can follow it later without
     breaking callers. `withServices` takes a bag by nature: it maps each service
     name to its provider.
   - Never two positional parameters. When the single required input does not read
     as a phrase with the method name, it goes into the bag under its role name:
     `buildModule({ exportedServiceKeys })`, because "build module greeter" says the
     wrong thing.
5. **Names state role, subject and unit.** "Name variables, parameters, and
   associated types according to their roles, rather than their type
   constraints." W3C:
   ["Name optional arguments appropriately"](https://www.w3.org/TR/design-principles/#naming-optional-parameters).
   `abortSignal`, `totalTimeoutMs`, `maxConcurrentServiceKeys`. This includes
   generic parameters and the parameter names of callbacks shown in
   documentation.
6. **Booleans read as assertions.** "Uses of Boolean methods and properties should
   read as assertions about the receiver when the use is nonmutating".
   `isPresent`, `allowsScopedDependencies`, `factoryReceivesContext`. The
   asserting verb is `is`, `has`, `allows` or `receives`, and it may follow its
   subject.
7. **No abbreviations.** "Avoid abbreviations." `factoryContext`, `dependencies`.
   The unit suffix `Ms` is kept as established precedent.
8. **Terms of art keep their established meaning.** "Stick to the established
   meaning if you do use a term of art", and "Embrace precedent." `resolve`,
   `container`, `child container`, `provider`, `token`. "Don't surprise an
   expert": a name borrowed from other containers must behave as it does there. A
   string value that has an established term carries it together with its
   description, as [`term:description`](#term-and-description-values).
9. **Common words before library words.** "Avoid obscure terms if a more common
   word conveys meaning just as well." W3C:
   ["Use common words"](https://www.w3.org/TR/design-principles/#naming-common-words).
   "Acquisition" names observability data only: snapshots, events, and the
   metadata an author attaches for them. It never names how a factory is written
   or how its result is treated.
10. **One word per concept.** W3C:
    ["Name things consistently"](https://www.w3.org/TR/design-principles/#naming-consistency).
    The [vocabulary](#vocabulary) is the dictionary and
    [`CONTEXT.md`](../../CONTEXT.md) holds the definitions.
11. **One casing per kind.** Identifiers are camelCase, types are PascalCase,
    runtime codes are `DI_BAG_SCREAMING_SNAKE`, and every string value is
    kebab-case, with one colon where rule 8 joins a term to its description.
12. **Methods before free functions.** "Prefer methods and properties to free
    functions." A facade function remains only when there is no object to hang it
    on.
13. **The summary test.** "If you are having trouble describing your API's
    functionality in simple terms, you may have designed the wrong API." A summary
    that needs "or" between two purposes marks a call to split.
14. **One way per task.** The
    [API card's table](../agent/api-card.md#one-way-per-task) names one call per
    task. When this standard offers two shapes for one task, one is chosen and the
    other is not shipped.
15. **Exceptions are measured.** A shape that the compiler cannot support within
    budget falls back to its previous form. The exception is recorded under
    [Measured exceptions](#measured-exceptions) with the measurement that forced
    it.

## Term and description values

A string value that has an established term of art is written `term:description`.
The term leads, so an expert finds it and an editor completes it after two
letters. The description removes the doubt about what the term means in this
library. Both halves are kebab-case and one colon joins them.

```ts
provider.withLifetime('singleton:one-per-container-tree'); // the default, rarely written
provider.withLifetime('scoped:one-per-container');
provider.withLifetime('transient:one-per-resolve');
```

Only the full value is accepted. `'scoped'` alone is rejected with a message that
names `'scoped:one-per-container'`, because two spellings of one value would break
rule 14. The pattern applies only where an established term exists. Today that is
the three lifetimes.

## Vocabulary

One word per concept. A retired word does not appear in a public name, a string
value or an error code.

| Concept | Word | Retired words |
| --- | --- | --- |
| The value other code receives | service | |
| Name or typed token that identifies a service | service key | key, name, selection |
| Declaration of how a service is obtained | provider | registration, when it means the value |
| A provider stored under a service key in a builder | registration | |
| A registration's node in a built graph, public or module-private | binding | |
| One attempt to obtain a service from a binding | acquisition, observability only | |
| Releasing an owned value | disposal, disposer | cleanup |
| How a factory's return value is treated | factory return kind | acquisition mode, mode |
| What a decorator callback is handed | callback receives | direct, awaited |
| Waiting until listed services exist and are settled | service readiness | startup, start |
| A resolvable set of services with its own cache and ownership | container | bag, as a concept word. `DiBag` stays the product and facade name, and "bag" now only means an options bag |
| One instance for a root container and all its child containers, the default | `'singleton:one-per-container-tree'` | root |
| One instance in each container that resolves it | `'scoped:one-per-container'` | |
| A new instance for every resolve and every dependency read | `'transient:one-per-resolve'` | |
| A root container and all its child containers | container tree | family, ownership family |
| A provider appended to a collection token's list | contribution | |
| Token that identifies exactly one service | single-service token | |
| Token that identifies an ordered list of services | collection token | the `all` reference, the contribution channel |
| A container nested in a parent for one unit of work | child container | scope, child scope |
| A container made from another's providers that shares no instance with it | independent container | fork, bag fork |

## What the naming test checks

[`tests/api-naming.test.ts`](../../tests/api-naming.test.ts) enforces the rules a
machine can judge. It reads the public surface with the TypeScript compiler API,
starting from the exports of `src/index.ts` and following every type reference
into `src/`. The public surface is what that walk reaches: exported names, member
names, parameter names and string values. Function bodies, constructors' plain
parameters, private members, `#private` names, symbol-keyed members and members
tagged `@internal` are not public. Names of helper types that are not exported
from `src/index.ts` are not checked, but their members, parameters and values
are, because they show up in editor hints and compiler messages.

String literals that name TypeScript structure are identifiers rather than
public values. The scanner excludes property-key positions (including mapped
keys and the key arguments of the standard `Pick` and `Omit` helpers), `keyof`
comparisons, operation labels passed through a type parameter named `Operation`,
the typed `details.operation` method reference on an exported `Error` subclass,
and `SeeErrors` documentation anchors. The `details.operation` exception applies
only to that diagnostic structure; an unrelated property named `operation` and
neighboring diagnostic fields remain checked. These literals describe a member,
operation, or diagnostic link; callers do not pass them as enum-like values.
Other generic arguments, including nested string values, remain part of the
checked surface.

| Check | Rule | What fails |
| --- | --- | --- |
| `builder-method-prefix` | 3 | A callable public member of `Builder` that does not start with `with`, `build` or `verify` |
| `boolean-name` | 6 | A member typed `boolean`, `true` or `false` with none of the words `is`, `has`, `allows`, `receives` |
| `abbreviation` | 7 | An exported name, member or parameter with one of the words `ctx`, `deps`, `opts`, `cfg` |
| `value-casing` | 11 | A string value that is neither kebab-case nor `term:description`, or a `DI_BAG_` code in `src/` that is not `SCREAMING_SNAKE` |
| `retired-word` | 10 | An exported name, member, parameter, string value or `DI_BAG_` code with one of the words `cleanup`, `startup`, `start`, `bag`, `root`, `family`, `scope`, `fork`, `mode`, `direct`, `awaited`, `all` |

Words are whole words of a camelCase, kebab-case or snake-case name, so
`acquisition-started` does not contain `start` and `scoped` is not `scope`. The
product prefix `DiBag` and the code prefix `DI_BAG_` are not words. The retired
words "key", "name", "selection", "registration" as a value, and "acquisition"
outside observability cannot be judged by a machine. Reviewers judge them, and
they judge rules 1, 2, 4, 5, 9, 12, 13 and 14.

The test is a ratchet.
[`tests/api-naming-known-violations.json`](../../tests/api-naming-known-violations.json)
lists the violations that existed in 0.4.0. A violation that is not listed fails
the test, and so does a listed violation that no longer occurs, so the list can
only shrink. It must be empty when phase 11 of the
[Swift API style program](../superpowers/plans/2026-09-21-00-swift-api-style-master.md)
ends, and it stays empty afterwards. After fixing names, shrink the list:

```sh
UPDATE_API_NAMING_VIOLATIONS=1 bun test tests/api-naming.test.ts
```

That mode only removes entries. A new violation is fixed by renaming, never by
listing it.

## Measured exceptions

Rule 15 allows a shape to fall back to its previous form when the compiler cannot
support it within the compile budget: a case of
[`scripts/evidence-cases.mjs`](../../scripts/evidence-cases.mjs) may grow by at
most 10% in instantiations over
[the 0.4.0 baseline](../superpowers/plans/evidence/baseline.md). Each exception is
one row here, added by the change that takes the fallback.

| Shape in the design note | Fallback taken | Measurement that forced it | Recorded in |
| --- | --- | --- | --- |
| Collection-token branches on `resolve` and `inspect` | Explicit `resolveCollection` and `inspectCollection` methods | The bounded compiler fixture repairs exhausted three attempts before S5 measurement; contextual collection replacement diagnostics remained unstable | [Phase 04 evidence](../superpowers/plans/evidence/phase-04.md) |
