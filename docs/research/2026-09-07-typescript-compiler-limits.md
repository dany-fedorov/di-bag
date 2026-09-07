# Compiler compatibility and the next inference experiments

Research date: 2026-09-07. No dependency, compiler pin or production API is changed.
Current measurements remain TypeScript 5.9.3 / Node 24.20.0 results.

## Verified upstream facts

TypeScript 6.0 was released on March 23, 2026. It changes how methods without
`this` usage participate in contextual inference, and also adjusts generic-call
checking. It retains the 5.9 compiler API but changes defaults and deprecates
Node10 module resolution. These are compatibility considerations, not evidence
that di-bag passes on 6.0. [Official 6.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)

TypeScript 7.0 was released on July 8, 2026 as the native Go-based compiler, so
it should not be described as only a preview. The 7.0 announcement says this
release has no programmatic compiler API and describes side-by-side installation
with the separate TypeScript 6 compatibility package. Its claimed broad speedups
are not di-bag benchmark results. [Official 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)

## Relation to local evidence

The nested snapshot probe fails inline but succeeds when the factory is
predeclared or the method has an explicit compatible `this` annotation. That
evidence is in [the inline investigation](../reports/2026-09-07-current-inline-inference.md).
Inference: the 6.0 contextual-inference change is a concrete reason to test the
unchanged reproduction on a newer compiler before trying another adapter
overload design. It is not proof of a fix, nor permission to erase receiver checks.

The original 1000-call fluent programs fail with a JavaScript RangeError in the
5.9 binder. A separate nongeneric ambient Builder reproduction also fails for
1000 fluent calls while its successive-statement control passes. This separates
a syntax-depth limit from di-bag's generic-checking cost and TS2589. The control
is `/tmp/di-bag-chain-syntax-control.cjs`; actual library evidence belongs to
[the compiler benchmark report](../benchmarks/typescript.md).

The bounded upstream search did not locate a directly matching issue or a
verified upstream fix for this exact reproduction. Do not infer that one compiler
release solves it merely from its implementation language or a general speed claim.

## Recommended next experiments, not adopted changes

1. In an isolated tool installation, pin and verify a TypeScript 6 release. Run
   both unchanged inline reproductions, exact output/needs/metadata/frame checks,
   negative receiver/union/token/module contracts, declaration emission and real
   installed CJS/ESM consumers. Compare with the retained 5.9 baseline. Record
   explicit compiler options and distinguish configuration-deprecation errors
   from user-contract diagnostics. Keep this a compatibility experiment before
   deciding on any supported-version floor or adapter API change.
2. Separately run the original fluent syntax and nongeneric control with pinned
   TypeScript 7's CLI. First establish a supervised time and native-process memory
   bound: Node's old-space flag does not bound a Go compiler. The existing virtual
   `Program`/instantiation-counter runner is not a drop-in harness for 7.0's CLI.
   Require actual source/declaration contracts and diagnostic locations as well
   as successful process completion; do not silently change source forms or
   equate counters from different compiler implementations. If the small controls
   pass, proceed to the unchanged large named/token cases and report each failure.

These are investigation recommendations, not execution results or additional
completion claims. The 5.9 baseline, large C/G costs, both inference cases and
all remaining enterprise requirements remain visible. The attempted background
research agent failed before producing evidence; these findings were checked
directly against the official sources by the controller.
