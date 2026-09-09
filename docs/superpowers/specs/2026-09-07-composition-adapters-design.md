# Class and positional function adapters

Execution refinement of E1 in the approved enterprise DI design. This increment
adds direct adapters for existing constructors and positional functions. The
remaining alias, optional/lazy dependency, and contribution work remains required
and will build on the same authenticated provider and token graph boundaries.

`DiBag.fromFunction(tokens, callback, options?)` adapts an existing positional
function. `DiBag.fromClass(tokens, constructor, options?)` creates class instances
with the selected positional arguments. Tokens are an exact finite tuple of
genuine typed handles. There is no parameter-name reflection, decorator metadata,
service locator argument, or automatic awaiting. Named factories remain supported
unchanged, and the existing `fromTokens` API remains compatible.

Both adapters retain the declared token graph, exact exposed output, acquired
value and configured acquisition mode. Empty argument tuples support no-argument
functions and constructors. Optional and rest parameters follow TypeScript tuple
assignability: the selected service-value tuple must be accepted by the declared
parameter tuple. Too few required arguments, incompatible types, and surplus
arguments to a finite tuple reject with useful diagnostics. A callback's required
receiver rejects; callers can explicitly bind their receiver before adaptation.
Unannotated function parameters receive the corresponding token service types.

Constructors must be concrete and constructable; abstract/protected/private
constructors and ordinary arrow functions cannot cross the static boundary. Use
`Reflect.construct` at acquisition to retain class prototypes, private fields and
`new.target`. Validate runtime constructability without invoking the user's
constructor (a Proxy construction trap can probe the target's internal
constructability without calling it or reading its prototype). Invalid callbacks,
constructors, tokens and acquisition modes reject during adapter declaration.
Input token tuples are snapshotted by index, ignoring custom iterators.

Ordinary callback or constructor throws remain acquisition failures, and retry
uses the existing attempt machinery. Explicit disposal owns the acquired
callback/class value only when wrapped in `withDisposal`; a class method named
`close` or `dispose` does not transfer ownership. Sync/native/raw modes, metadata,
projection frames, scopes, sharing, overrides, startup and cancellation retain
existing semantics. A native mode requires a statically Promise-valued result.
The default automatic mode still requires configured runtime classification.

Acceptance covers plain and inherited classes, private fields, required/optional/
rest constructor and function arguments, empty selections, sync throws/retry,
Promise identity, raw/native ownership, structurally thenable class instances,
receiver binding, forged handles, hostile tuple iterators/getters, and no eager
constructor effects. Source and installed classic/native positive and negative
fixtures must retain inferred output and graph requirements; inferred producer
emission must work with producer source removed. Actual packed Node/Bun CJS/ESM
execution must exercise the adapters. Do not add native diagnostic gap allowances.
