# Typed-token composition design

Date: 2026-09-07. Design refinement under the approved continuous enterprise
program. This is an implementation target, not a completed capability claim.
Parent: `2026-09-06-enterprise-di-design.md`; all its Global Constraints apply.

## Selected approach and alternatives

Use caller-declared unique-symbol identities in nominal typed handles, explicit
binding, and a finite token-tuple adapter for ordinary positional callbacks.
Keep named object-parameter factories and named add unchanged. This adds a
checked boundary for reusable modules without making every local dependency a
token declaration or requiring decorators/reflection.

Payload-only or label-only token constructors cannot distinguish independent
tokens of the same type/label. A separate parallel token container would duplicate
scope/ownership machinery. Token reads instead use the existing binding graph and
acquisition runtime. Do not encode phantom token contracts into service values.

The bounded source/emitted carrier proof is recorded in
`../../reports/2026-09-06-typed-token-carrier-investigation.md`. It supports one
additional provider contract, not a universal production or scalability claim.

## Public identity and composition

```ts
const databaseKey = Symbol('database');
const database = DiBag.token(databaseKey).of<Database>();
const service = DiBag.fromTokens([database], db => ({ read: () => db.read() }));
const bag = DiBag.begin().bind(database, createDatabase)
  .add({ service }).end();
const db = bag.resolve(database);
```

`DiBag.token(key).of<Service>()` returns a frozen, genuine `Token<K,Service>`.
Its readonly `key: K` supports explicit computed override maps. Export the type,
not its constructor, and export `TokenKey<T>` and `TokenService<T>` type views.
Both key and service are invariant through source and declaration emission.
Canonical keys are direct caller const symbols. Reject broad, union, never,
inline/function-returned broad symbols and opaque/spread handles at checked use.
Do not claim the erased service type can be authenticated at runtime.

Same actual symbol/same service rewrapping denotes the same slot, not a new
binding. Distinct symbols with identical descriptions remain distinct. Mixing
incompatible invariant service declarations for one symbol rejects in a checked
graph even if a concrete implementation structurally satisfies both. Symbol.for
can give distinct static unique-symbol types the same runtime value: duplicate
runtime checks remain mandatory. Prefer one exported canonical token.

Builder and ModuleBuilder gain `bind(token, registration)`, introducing a new
slot only. Validate actual provider output against the declared token service
without inferring a wider service from the provider. Retain original output,
named/token requirements, metadata, frames and ownership. Reusing a provider
under another token does not mutate its original description or earlier binding.

`replace(token, registration)` requires an existing, compatible token contract,
retains that declared service, and validates all remaining consumers plus the
replacement's own requirements. It can infer a richer output, but cannot discard
requirements. Existing named replacement and its graph-aware inference stay intact.

Bag `resolve(token)` returns the actual registration's exact output, including
richer shapes and raw Promise identity; `inspect(token)` retains exact metadata
and frames. Membership and invariant service checks are separate from output
lookup. Use a direct bounded indexed return, not the prototype's compiler-expensive
nested conditional return. Existing named resolve/inspect and generic calls stay
compatible.

## Explicit token injection

`DiBag.fromTokens(tokens, callback)` accepts a required finite tuple of individually
known genuine typed tokens. Callback arguments are the corresponding declared
service types in order; callbacks may ignore arguments but cannot require extra
arguments or an explicit non-void receiver. The result is a provider with no
ordinary named needs, exact callback output, and retained token requirements.
No dependency or return is implicitly awaited, including Promise-valued tokens.

Snapshot tuple indices before using selected handles; ignore custom iterators and
extra tuple properties. Reject widened, optional, union-shaped or invalid tuples.
Preflight the complete selection before invoking factories. At acquisition, read
every selected dependency in tuple order, then invoke the callback once without
a receiver. Repeated selections of the same compatible token are allowed and use
the normal binding cache; distinct incompatible service contracts for one symbol
cannot close the graph. This API is explicit eager argument injection, not lazy
or optional dependency selection. Those remain separate enterprise extensions.

Ownership remains explicit via withDisposal. All existing mapping, metadata,
disposal and box adapters preserve token requirements and exact output semantics.
The token adapter does not create another container or independently memoize.

## Type representation and module boundary

Use a fourth invariant provider graph contract G alongside F/M/A. The empty
contract retains no required tokens and no bound token. Required-token tuples
and a binding's declared token contract are separate fields. Binding creates a
slot-specific retained view; it does not change a reusable source callback.
Erased graph contracts remain opaque/unprovable, never dependency-free.
Expose `ProviderTokenNeeds<R>` as the required-token union; ordinary ProviderNeeds
keeps describing the named factory parameter contract. Utilities and callbacks
must retain exact heterogeneous unions through NoInfer.

Keep the flat Entry history and reconstruct keyed maps only at check boundaries.
Generalize internal public-slot keys to string or symbol, not public named add
admission. Numeric, broad and structurally hidden selections stay rejected or
ignored according to the existing explicit-selection boundary. Check named
requirements of token-bound providers as well as token requirements of named
providers, in both registration orders and at replacement/closure.

Retain Module<P,R,C,D>, with an expanded tagged C for named, token and opaque
constraints and D for public provider views. Do not add a fifth module generic
just to carry token requirements. Unlike the feasibility model's install-time
projection, use the existing export-time public projection: public D has synthetic
zero named/token needs but exact output/M/A and any bound token contract. C retains
requirements on exported or external slots; satisfied private requirements do
not leak into host closure. Opaque members cannot disappear during this projection.
This timing difference is an explicit production integration obligation.

`module.exports([...namesAndTokens])` selects an exact finite tuple of names and
compatible token handles. D carries both named and token slots. ModuleProvides
and ModuleRequires expose readonly views keyed by names and unique symbols;
invariant C/D retain the full service-contract proof beyond those views. Existing
plain default Module and Provider annotations remain usable only when they do
not erase nonempty metadata, frames or graph/token contracts.

Private token bindings receive fresh installation-local binding IDs, like private
names. Private consumers of an exported token follow its public slot and observe
public replacements/fork overrides. Private satisfied tokens are not resolvable
from the host. Named rename does not rename token identity or retarget an external
token. Cross-file declaration consumers must retain all of these contracts.

## Explicit fork selection

Extend the existing selected-key fork tuple to contain names and token handles:

```ts
const child = bag.fork([database], {
  [database.key]: replacementDatabase,
});
```

Token handles authorize selection; map keys are the actual symbols. Snapshot
tuple indices, validate every selected handle/key/membership first, then read
only selected own override properties. Hidden/unselected properties never apply.
Selected keys remain required even with explicit generics. Reject missing,
incompatible, opaque or ambiguous selections. Preserve the current fork rule:
new output must be assignable to the original actual output and all named/token
consumer constraints must remain satisfied. Ordinary fork() still makes a fresh
independent root with no resource sharing.

## Runtime routing and observation

Use actual symbol identity in BindingGraph public slots. Bindings keep stable
internal IDs; descriptions/labels are diagnostic text, never identity. Trusted
token-source descriptions retain their declared symbol dependencies. The
acquisition dependency Proxy routes those symbols through the existing lexical
private/public references and resolveBinding, recording ordinary attempt edges.
Undeclared symbol inspection of ordinary named factories retains its prior
undefined behavior; do not turn every well-known symbol read into a dependency.

Token and named edges share caching, source permission during close, retry,
cycle detection, failed incoming-edge retirement, pending-work retention and
dependency-ordered finalization. Preserve native Promise observation and original
disposer arguments. Runtime invalid-token/duplicate/missing-selection checks
must precede factory invocation and preserve a reusable builder after rejection.
All immutable snapshots retain their current boundaries; no deep-freezing payloads.

## Required verification and delivery

Source/emitted positive and exact negative fixtures cover token identity/service
invariance, key/tuple admission, explicit generics, missing/wrong dependencies in
both orders, binding/replace/fork, renamed named exports, private token isolation,
opaque carriers, default annotations, Promise outputs, metadata/frame retention,
mixed NoInfer unions and the twice-installed inferred resolve regression.

Runtime tests cover same/different symbol identity, Symbol.for duplicates,
borrowed/owned resources, token/named cycles, retries, async edges, close ordering,
custom tuple iterators, selected override getters and private/public module routes.
Actual packed CJS/ESM consumers use the same genuine token/provider registry,
including real box adapters. Add a runnable token module example and migration
notes. Run all existing tests/examples and current scale gates; add token-specific
100-provider and 100-module positive/missing/wrong-contract compiler controls.
Keep larger T2 work open; no claim that this increment completes lifetime,
startup, observer, plugin, platform or comparative-benchmark obligations.
