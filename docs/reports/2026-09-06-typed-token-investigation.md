# Typed token identity: bounded feasibility evidence

This is a declaration-only investigation against `8659198`, not an implemented
token API or full-library compatibility proof. The illustrative syntax
`DiBag.token(key).of<Service>()` has not been selected for production.

## Identity boundary

A payload-only token factory cannot distinguish two fresh runtime tokens of
the same service type. Adding a literal label does not distinguish separate
calls with equal labels either. A useful local `resolve<T>` result alone does
not prove that the requested token was registered.

Capturing a caller-declared unique symbol does retain separate identities:

```ts
const databaseKey = Symbol('database');
// Feasibility sketch, not current di-bag API:
const database = token(databaseKey).of<Database>();
```

The sketch uses private nominal provenance plus a function-valued invariant
witness under an unexported symbol, retaining both key and service in emitted
declarations. An erased nominal base is rejected at checked operations.
Inline `Symbol()` arguments, ordinary function-returned symbols, widened
symbols, union identities and the tested branded broad symbol fail admission.

The virtual graph retains supplied and required token contracts separately.
Binding A cannot close or resolve distinct B even when both promise the same
service and have the same label. Same-symbol, same-service rewrapping works;
same-symbol incompatible service contracts and duplicate binding reject.
Spread handles, explicit opaque generics, and invariant annotation erasure
also reject. Exact output assertions remain intact.

## Independent verification

`node /tmp/di-bag-token-identity.L4tGBa/check.mjs` passed with TypeScript 5.9.3
and Node 24.20.0. Both source and emitted-declaration consumers produced zero
unexpected diagnostics. Removing the expected-error directives produced 28
diagnostics at exactly the expected positions and matching codes in both modes.
The controller independently reran the complete harness successfully.

The sketch's API/graph functions are ambient declarations; this does not test
a DI runtime. The only runtime controls compare actual symbol identities.
No preliminary `any`, casts, decorators, reflection or generated production
functions were used to manufacture the checked examples.

## Runtime limits and integration obligations

Two declarations using `Symbol.for('same')` can have distinct unique-symbol
types but the same actual runtime symbol. Runtime duplicate checks remain
mandatory. A unique-symbol type is not proof of allocation freshness.

Erased generic service types cannot enforce a process-global symbol-to-service
mapping. Rewrapping one symbol with another service type can be constructed;
the checked graph must reject mixing those contracts. Prefer exporting one
canonical token. Runtime provenance/membership checks do not validate payload
types; dynamic validation requires a separate explicit contract.

Current named Entry/registration/dependency/module contracts intentionally
accept finite string keys. Tokens need an explicit integration channel that
retains identity, service, provider metadata/frames, and unresolved requirements
through module boundaries. A finite local-name-to-token selection can preserve
ordinary named factory parameters. Runtime-only selection metadata cannot
prove graph closure. No carrier layout or final API is adopted by this report.

Full local advisory: `/tmp/di-bag-typed-token-identity-advisory.md`; source and
emitted probes are under `/tmp/di-bag-token-identity.L4tGBa/`. Full production
compatibility, runtime ownership and scale measurements remain future work.
