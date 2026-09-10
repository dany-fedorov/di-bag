# Draft: stack overflow in long call/property-access chains, including an `any` receiver

Status: local draft only. No upstream issue or message has been submitted.

Observed with authentic TypeScript 6.0.3 and Node 24.20.0, strict options, default execution stack, a 3,072 MiB V8 old-space limit and a 60-second deadline. A generated expression with 1,000 chained method calls crashes with `RangeError: Maximum call stack size exceeded` rather than completing ordinary checking or producing a controlled diagnostic.

The exact expression is retained in the attached evidence's generated-source controls. The named form is `DiBag.begin().add({...}).add({...})...end()`. The replacement form begins with a registration object and performs 1,000 `.replace(...)` calls. Neither test uses recursive user-defined conditional types in the generated source itself.

Two levels of isolation are available. A library-free imported trivial fluent API or imported `any` reproduces an overflow in binding at 1,000 calls, while the 500-call controls pass. In the real source graph, changing only the exported facade annotation from `Facade` to `any` reproduces the checker overflow in `resolveCallExpression` entering `resolveUntypedCall`. That control bypasses all facade-driven registration validation and history. It retains the rest of the real source graph so the compiler reaches the same broad phase as the original failure.

The longer error captures show repeated ten-frame call/property-receiver cycles. In the root-any cases, the formatter collapses 9,990 or 10,000 duplicate frames; the expanded named-frame counts are 10,049 and 10,059, excluding anonymous frames. The original typed cases similarly show 10,079 named frames. The error-capture length was increased solely to record the stack; execution stack size was not increased. Normal acceptance runs retain the original error reporting and all resource settings.

Expected result: the compiler should handle this ordinary expression depth, or at minimum report a controlled diagnostic instead of an execution-stack crash. The controls do not ask the compiler to prove the DI library's contracts after the facade has been typed as `any`.

Potential direction, not an implemented patch: traverse long ordinary call/property-access receiver chains using an explicit continuation stack, preserving existing lookup, argument/context checking, overload resolution, flow state, cache behavior and result propagation. The binder also needs consideration because the smaller imported controls fail earlier there. Merely deferring expensive arity checking does not address the demonstrated untyped-call overflow.

The exact source, flags, compiler hash, raw failures, corrected stack summaries and reproduction workers are in [the accompanying evidence](README.md). The [library source revision](https://github.com/dany-fedorov/di-bag/tree/59d10c6c8ac13d63171f9f39c170da048d7e208c) is `59d10c6c8ac13d63171f9f39c170da048d7e208c`, published in [PR 10](https://github.com/dany-fedorov/di-bag/pull/10). This draft makes no claim that every declaration arrangement fails, and no library validation erasure or compiler patch has been adopted.
