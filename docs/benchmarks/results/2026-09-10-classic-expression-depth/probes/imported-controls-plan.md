# Diagnose classic expression depth independently of DI types

The exact final library source still fails the original 1,000-call named and replacement cases. Previous nongeneric controls declared the API in the same source and overflowed during binding/flow, whereas the original imported library overflowed in type checking. That difference prevents attributing the original failure solely to the control's stack.

Hypothesis: importing even a trivial API through the original module boundary can establish whether nested call syntax alone reproduces the checker failure before meaningful DI type work. Keep the original generated source byte-for-byte and virtualize only `src/index.ts` as either a three-method nongeneric fluent class or an `any` export. No other library source may be loaded. Run both forms at 500 and 1,000 in fresh authentic classic6.0.3 processes, same compiler options, default stack, 3,072 MiB old-space and 60-second timeout. Extended captured error stacks are diagnostic only; these do not replace acceptance rows or change the compiler.

If the failure still differs from the original checker path, retain the limitation of the control. A control passing does not prove a compatible DI API can pass; a control failing does not alone prove every library type reformulation must fail. Inspect where the work fails before another type-only proposal.
