# Checked aliases

This is the next E1 increment after explicit dependency references. An alias
gives an existing dependency another checked lookup name or token while resolving
the same acquisition. It adds no factory execution, resource owner or value cache.

## Public composition

`Builder.alias(destination, target)` and `ModuleBuilder.alias(destination, target)`
return a new immutable builder. Each argument is one singleton string name or one
genuine typed token. The destination must be new. A named target must already be
known to that builder so its value contract can be inferred. A token target may
be supplied later or by the module host; its declared service contract is already
known, and final graph completion still requires the matching binding.

A named target supplies its existing provider output contract. A token target
supplies the token's declared service contract, including an exact Promise value.
A token destination requires that output to be assignable to its declared service.
The destination retains its own invariant token identity. Arbitrary symbols,
widened/union-valued selections, reference wrappers and forged token handles do
not establish an alias. No string parsing, parameter reflection or user-defined
runtime type assertion is involved.

Aliases are builder operations, not publicly exposed provider handles. To project
or add ownership to a dependency, users can declare an ordinary provider that
reads it. The alias operation does not invent transformation or disposal policy.

## Runtime routing and ownership

Alias resolution follows the target in the alias binding's lexical graph. It
preserves module-private identities, renamed exports and external requirements.
Public target replacement or child override takes effect according to that graph;
sharing the alias into a child routes it through the parent's graph and owner.
Independent forks use their own graph and ownership family.

Resolution returns the canonical target acquisition. Scoped/root targets preserve
their existing identity and pending Promise. Every read through a transient alias
creates the same new target attempt that a direct read would create. Consumers
record their dependency on that actual attempt, so aliases introduce no extra
disposal and cannot obscure a runtime captive dependency. Alias-to-alias chains
follow the same rules and detect cycles with a useful path.

An alias must not require automatic Promise-classification capability when the
canonical target explicitly uses raw/native mode. It must not wrap or assimilate
the target value. Eager startup waits for the canonical acquisition's final
readiness; failure, retry, cancellation and shutdown retain target semantics.

Selected sharing of an alias borrows the canonical parent acquisition. It rejects
when the target is transient, just as direct transient sharing does. Overriding
an alias destination replaces that destination independently; overriding its
target affects remaining aliases in the corresponding child graph. Sharing an
alias while overriding its target in the child continues to read the parent
target, consistent with selected sharing of ordinary consumers.

Inspection identifies the alias relationship without promising stale metadata
from a target that can later be replaced. Runtime acquisition inspection follows
canonical attempts; its type view must remain conservative where composition has
not retained an exact target metadata contract. Do not infer a disposer or expose
mutable resolver state through inspection.

The optional immutable alias relationship reports the direct target binding ID
and label. Resolve it in the alias's effective owner graph, including parent
routing for selected sharing, so a child override cannot make inspection identify
a target that resolution bypasses. Canonical acquisition snapshots remain
separate from this direct chain relationship.

## Static contracts

Alias dependencies participate in shape checking, nominal token checking,
missing-factory detection and lifetime walks. Named target replacements must
continue satisfying the alias output promised to its consumers. Token-target
aliases retain the token's service and nominal contract. Module public views and
exportless/private constraints must retain these obligations across installation
and export renames. Aliases cannot conceal root-to-scoped captures, including
paths through transients or optional/lazy dependencies.

Builder histories, provider unions and reflected method views must remain sound.
Physical inferred classic/native declarations must preserve alias outputs and
unsatisfied obligations after producer source deletion. Native diagnostic quality
allowances and compiler-work ceilings do not change in this increment.

## Acceptance

Cover all four name/token source-destination combinations, forward external token
targets, duplicate/missing/incompatible selections, alias chains/cycles, actual
target identity and Promise modes, transient multiplicity, once-only cleanup and
observed dependency ordering. Exercise private modules, export renames, host
collisions, root/captive checks, selected sharing with child overrides, independent
forks, eager startup readiness, acquisition failures/retry and retained reads during
shutdown. Run physical Node/Bun CommonJS/ESM archives from both declaration emitters,
with producer source removed for downstream compiler checks.

Contributions, observers/plugins, compiler limits/diagnostic quality and release
confidence remain required program work after aliases.
