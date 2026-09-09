# Inline async fork inference: bounded investigation

This is read-only evidence against `b557a75` and TypeScript 5.9.3, not an
implemented inference improvement or a universal type-safety claim.

## Reproduction and cause

An inline selected override can fail when one provider returns richer methods
and an annotated async provider requires one of those methods:

```ts
const providers = {
  service: () => ({ read() { return Number(1); }, extra() { return true; } }),
  promised: async () => 7,
};
const root = DiBag.begin().add(providers).end();
const richer = root.fork(['service', 'promised'], {
  service: () => ({
    read() { return 3; }, extra() { return true; }, richer() { return 9; },
  }),
  promised: async ({ service }: { service: { richer(): number } }) => service.richer(),
});
```

The baseline rejects the async callback with TS2322 and falls back to
`ForkContext<R, K, unknown>`, losing the richer output. Predeclaring the
unchanged override object compiles without casts. Changing returned methods
to arrow-valued members also compiles and isolates contextual sensitivity.

Compiler-source inspection and inferred-type probes support a preliminary
applicability failure: contextual method-return inference is delayed while the
annotated async callback is checked against the original dependency graph.
It is not a newly introduced module/runtime regression.

## Candidate evidence, not adoption

A virtual signature-only candidate changes the preliminary dependency parameter
in both ForkContext branches to:

```ts
unknown extends O
  ? { [P in keyof R]: any }
  : Provided<Merge<R, Selected<K, O>>>
```

The direct selected-registration intersection and final graph checks remain.
The advisor measured exact richer output and `Promise<number>`, all 46 existing
diagnostic locations in 16 focused negative fixtures, and the same results
through seven in-memory emitted declaration files. The controller independently
reproduced the positive exact inference and a matched missing-richer TS2322
rejection. No full-suite, scale or exhaustive adversarial proof was performed.

The preliminary `any` is a substantive concern; this candidate requires a
dedicated implementation and review before adoption. It is not production code.
A no-`any` bivariant optional-unknown alternative incorrectly accepted two
existing missing-dependency fixtures and is rejected. Preliminary `never`
alternatives failed the positive reproduction.

Full local evidence: `/tmp/di-bag-inline-async-inference-advisory.md` and
`/tmp/di-bag-inline-inference-investigate.cjs`. The probe uses committed source
and a virtual CompilerHost; it writes no repository files. Existing inference
boundaries and the predeclared-object workaround remain the production contract.
