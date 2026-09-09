# Validated dynamic plugin providers

This P1 increment supplies an explicit runtime boundary for configuration-selected
code. Statically imported modules and statically typed dynamic imports continue to
use the existing exact `Module` contracts. An unknown plugin enters as one provider
whose host dependencies and consumer-visible result are declared by its adapter.
That provider can then be bound, contributed, exported or renamed in typed modules.

## Chosen boundary

`DiBag.fromPlugin(dependencies, plugin, { acquisition, validate })` accepts an
unknown descriptor, a checked tuple of existing dependency references and a
host-supplied synchronous type predicate. It produces an authenticated provider
with the dependency tuple's exact graph contract and the predicate's result type.

The plugin protocol has these own fields:

```ts
{
  apiVersion: 1,
  create: (...dependencies) => value,
  dispose?: value => void | Promise<void>,
}
```

`apiVersion` must be exactly the number `1`, and `create` must be a function.
When the own `dispose` field is present it must be a function; present `undefined`
is invalid. Required fields inherited from a prototype are invalid. Extra fields
are ignored without reading their values. Arrays, null and non-object descriptors
are invalid. The caller selects a module namespace's export explicitly; the
library does not import paths, execute loaders or infer a default export.

The required options have `acquisition: 'raw' | 'native'` and
`validate: (this: void, value: unknown) => value is V`. There is no default or auto
mode at this boundary. Configuration and dependency reference validation occur
before descriptor callback values are read. Check required own keys and protocol
version before reading `create`/`dispose`. Capture callback references once;
later mutation of the descriptor/options/tuple cannot change the provider. Do not
invoke `create`, `dispose` or `validate` while constructing the adapter.

Callbacks receive no receiver. The `create` callback receives the exact positional
dependency values using the existing required/optional/lazy/all semantics. It is
never passed a bag or an unrestricted resolver. Dependencies are neither awaited
nor unboxed by this adapter.

## Validation and acquisition

In raw mode the validator receives the exact returned value synchronously. It
must return exactly `true`; any other returned value, including a Promise or
thenable from unchecked code, fails validation without assimilation. A valid value
is exposed unchanged, including Promise, thenable, present-undefined, function
and object identity. The raw provider output and acquired contract are `V`.

In native mode the source stage explicitly requires a genuine native Promise,
using the existing explicit-native machinery. The validator runs synchronously
on its fulfilled value. The adapter creates an explicit validated final Promise
stage with output/acquired contracts `Promise<Awaited<V>>` and `Awaited<V>`.
The source Promise is retained as the source stage; consumers receive the final
validation Promise, whose identity is stable for a cached attempt. Validation
failure rejects that final stage. This explicit boundary does not change native
Promise identity or modes in ordinary providers elsewhere.

For both modes, factory throws, native rejection and validator throws retain
their original error identity through existing acquisition/startup handling.
A false or invalid validator result throws `DiBagPluginError` with
`phase: 'output'`. Invalid descriptors throw it with `phase: 'descriptor'` before
factory effects. The error gives a concrete reason without retaining the rejected
service value. Invalid adapter options/dependency handles use the existing style
of configuration errors. Descriptor getter exceptions retain original identity.

Validation is admission of a value at this boundary, not continuous monitoring of
mutable services or a proof about arbitrary callback behavior. A host predicate
must actually check the service contract its type advertises. Unknown plugin code
still executes as application code; protocol/result validation does not sandbox it.

## Ownership and composition

An optional plugin disposer declares ownership of the original acquired source
value. Accept that ownership before output validation. Successful validation does
not transfer it to a new resource. If validation fails after acquisition, existing
retirement/rollback releases the accepted value exactly once; pending disposal is
drained by close, and disposal failures keep existing structured aggregation.
Native disposal receives the fulfilled source value, while raw disposal receives
the exact raw value. No disposer is called when the factory never acquired a value
or its native source rejected.

Use the current staged provider operations and canonical acquisition machinery;
do not create wrapper bags, extra acquisition owners or a parallel plugin runtime.
Additional host `withDisposal`, metadata, lifetime and mapping operations compose
through the usual typed provider APIs. Contextual host dependencies retain their
own acquisition contexts. Scope sharing, aliases, module
privacy and contributions preserve the same identities and cleanup semantics.
Lifecycle observers report the existing canonical attempt, final validated
readiness and accepted ownership cleanup without synthetic plugin attempts.

The dependency tuple is the adapter's complete declared host graph. Use the
existing immutable reference snapshots and runtime dependency routing; do not
reflect parameter names or trust erased function annotations. Compile-time checks
prove the host's declared token contracts and composition, while runtime checks
validate the plugin protocol and predicate result. They do not manufacture a
global type proof for arbitrary imported code.

## Example shape

```ts
interface Handler { handle(text: string): string }
const handlerKey = Symbol('handler');
const handler = DiBag.token(handlerKey).of<Handler>();
const selected: unknown = {
  apiVersion: 1,
  create: () => ({ handle: (text: string) => text.toUpperCase() }),
};
const provider = DiBag.fromPlugin([], selected, {
  acquisition: 'raw',
  validate: (value: unknown): value is Handler =>
    typeof value === 'object' && value !== null &&
    'handle' in value && typeof value.handle === 'function',
});
const feature = DiBag.module().bind(handler, provider).exports([handler]);
const bag = DiBag.begin().install(feature).end();
bag.resolve(handler).handle('hello');
await bag.close();
```

The example checks only the structural callable interface shown. An application
whose contract needs stronger semantics supplies the corresponding validator.

## Types, compatibility and evidence

Export the error and public option/predicate/result helper types required by
physical inferred declarations from the package root. Preserve exact provider
outputs, acquired types, reference graphs and every current invariant carrier.
Do not accept a boolean-only or async validator statically, optional/missing mode,
auto mode, invalid dependency tuple or required callback receiver. Output inference
comes from the predicate, never from `plugin: unknown`; do not add a result cast at
the application boundary. Keep existing classic/native diagnostic allowances and
compiler-work ceilings unchanged.

Test shape/version/getter preflight, immutable snapshots, callable validation,
required/optional/lazy/all dependencies, raw/native identity, invalid output,
throws/rejections, accepted ownership before validation, pending cleanup and
startup rollback. Cover module-private host dependencies, aliases/contributions,
selected sharing, observers and hostile thenable output in raw mode. Actual
classic/native archives must run the shared assertions on Node/Bun CJS/ESM and
physical inferred producers must survive source deletion and both compilers.
Broader platform/performance/release and compiler scale/message hardening remain
separate required work.
