# Migrating to the single builder

[README](../../README.md) · [Tutorial](../guides/tutorial.md#reuse-named-modules) · [Earlier migrations](api-renaming.md)

This is a breaking pre-1.0 API change. `ModuleBuilder` and
`DiBag.createModuleBuilder()` are removed. One `Builder` now builds bags and
seals modules; `BagBuilder` is renamed to `Builder`. No compatibility aliases are
retained. The dependency graph, lifetime, acquisition, and ownership rules are
unchanged.

## Replaced names

| Previous | Current |
| --- | --- |
| `DiBag.createModuleBuilder()` | `DiBag.createBuilder()` |
| `ModuleBuilder<E, C>` (type) | `Builder<E, C>` |
| `BagBuilder<E, C>` (type) | `Builder<E, C>` |
| `ModuleContribute<E, C>` (type) | `BuilderContribute<E, C>` |
| `ModuleContributionConstraints<C, R, P>` | Unchanged name; now also encloses constraints retained from nested installations. |

```ts
// Before
const feature = DiBag.createModuleBuilder()
  .register({ connection: () => ({ open: true }), service: ({ connection }: { connection: { open: boolean } }) => connection })
  .buildModule(['service']);

// After
const feature = DiBag.createBuilder()
  .register({ connection: () => ({ open: true }), service: ({ connection }: { connection: { open: boolean } }) => connection })
  .buildModule(['service']);
```

`register`, `replace`, `alias`, `contribute`, `installModule`, `build`,
`buildAndStart`, and `buildModule` are all available on every builder. The
sealed `Module` value, `installModule`, and `renameExport` keep their names and
behavior. A missing dependency is still a compile error at `build()` and still
becomes a module requirement at `buildModule(keys)`.

## What one builder changes

- **Modules nest.** A builder that has installed modules can seal into a module.
  Requirements the inner module leaves unmet pass outward unless the enclosing
  module satisfies them. Names resolve lexically: inner registrations, then the
  enclosing module's, then the host's. Every installation receives fresh private
  identities and separate disposal ownership at every depth.
- **Reflected `replace` views are widened views.** `ReturnType<typeof builder.replace>`
  is no longer assignable from the concrete builder for a module graph, exactly as
  it already was not for an application graph. Keep the concrete builder value and
  call `buildModule` on it; use `typeof` or `ReturnType` on the sealed module when
  a contract crosses a file boundary.
- **Registration checks run incrementally for module graphs too.** Adding a
  registration checks the relationships that cross into the new entries rather
  than rescanning the accepted history. Results are the same; large module graphs
  compile with less work.

## Lexical type contracts

`LexicalContext` gains an optional `parent`. Constraints and providers retained
from a module that was itself installed inside another module carry a chain of
contexts ending at the host. New exported helpers describe that chain:
`ModuleScope`, `Enclosed`, `RenamedContext`, `EnclosedLifetimeObligation`,
`SealedConstraints`, and `ModuleSealedConstraints`. Code that only annotates
through `typeof` or `ReturnType` needs no change.
